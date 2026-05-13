const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam');
const fs = require('fs');
const path = require('path');
const { parsePositiveInt } = require('../../utils/validation');
const { getStoredOrGenerateStatisticsSnapshot, getExamReadiness } = require('../../services/examStatisticsService');
const { getTeacherExamAccess } = require('../../services/examAccessService');
const { buildCorrectionHtml, getCorrectionDocumentBundleByResultId } = require('../../services/correctionDocumentService');

const logDebug = (msg, data) => {
    const logPath = path.join(__dirname, '..', '..', 'debug_log.txt');
    const time = new Date().toISOString();
    const logLine = `[${time}] ${msg} : ${JSON.stringify(data, null, 2)}\n`;
    fs.appendFileSync(logPath, logLine);
};

const normalizeDurationMinutes = (value, fallback = null) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return fallback;
};

// Fetch all exams created by the logged-in teacher
const getTeacherExams = async (req, res) => {
    try {
        const teacher_id = req.userId;
        
        // Fetch metadata from MySQL
        const query = `
            SELECT e.id, e.title, e.creation_date, e.module_id, e.status, e.duration_minutes, e.start_time, e.end_time, e.require_seb,
                   e.llm_provider_config_id, m.name as module_name, m.abbreviation as module_abbreviation
            FROM exams e
            LEFT JOIN modules m ON e.module_id = m.id
            WHERE e.teacher_id = ?
            ORDER BY e.creation_date DESC
        `;
        const [mysqlExams] = await pool.query(query, [teacher_id]);

        if (mysqlExams.length === 0) {
            return res.status(200).json([]);
        }

        // Fetch corresponding MongoDB documents
        const examIds = mysqlExams.map(ex => ex.id);
        const mongoExams = await Exam.find({ _id: { $in: examIds } }).lean();

        const readinessByExamId = new Map();
        await Promise.all(mysqlExams.map(async (exam) => {
            const readiness = await getExamReadiness(exam.id, teacher_id);
            readinessByExamId.set(exam.id, readiness);
        }));

        // Merge data
        const mergedExams = mysqlExams.map(mysqlExam => {
            const mongoExam = mongoExams.find(m => m._id === mysqlExam.id);
            const readiness = readinessByExamId.get(mysqlExam.id);
            return {
                ...mysqlExam,
                status: readiness?.exam?.status || mysqlExam.status,
                examData: mongoExam ? mongoExam.examData : null,
                statisticsReadiness: readiness ? {
                    ready: readiness.ready,
                    examEnded: readiness.examEnded,
                    allSubmitted: readiness.allSubmitted,
                    eligibleStudents: readiness.eligibleStudents,
                    submittedStudents: readiness.submittedStudents,
                    pendingStudents: readiness.pendingStudents,
                } : null,
            };
        });

        res.status(200).json(mergedExams);
    } catch (error) {
        console.error("Error fetching teacher exams:", error);
        res.status(500).json({ message: "Server error fetching exams." });
    }
};

const createExam = async (req, res, next) => {
    const connection = await pool.getConnection();
    
    try {
        const { title, module_id, duration_minutes, examData, llm_provider_config_id } = req.body;
        const teacher_id = req.userId;

        if (!title || !examData || examData.questions.length === 0) {
            return res.status(400).json({ message: "Title and at least one question in examData are required." });
        }

        // 1. MySQL Transaction
        await connection.beginTransaction();

        const insertQuery = `INSERT INTO exams (teacher_id, module_id, title, duration_minutes, status, llm_provider_config_id) VALUES (?, ?, ?, ?, 'DRAFT', ?)`;
        // Execute the insert to get the Auto-Incremented ID
        const [result] = await connection.query(insertQuery, [teacher_id, module_id || null, title, duration_minutes || 60, llm_provider_config_id || null]);
        
        const sqlInsertId = result.insertId;

        // 2. MongoDB Insertion
        const newExamDocument = new Exam({
            _id: sqlInsertId,
            examData: examData
        });

        await newExamDocument.save();

        // 3. Commit MySQL Transaction only if MongoDB save was successful
        await connection.commit();

        res.status(201).json({
            message: "Exam created successfully",
            examId: sqlInsertId
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating exam:", error);
        
        // Return 400 for duplicate key or bad requests, 500 otherwise
        if (error.code === 11000) {
             res.status(400).json({ message: "Duplicate Database Entry Error. Please try again." });
        } else {
             res.status(500).json({ message: "Internal server error during exam creation" });
        }
    } finally {
        connection.release();
    }
};

// Publish an exam (make it LIVE) and assign it to groups
const publishExam = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { groupIds, start_time, end_time, require_seb, duration_minutes } = req.body;
        const teacher_id = req.userId;

        // Verify the exam belongs to the teacher
        const [examCheck] = await connection.query(`SELECT id, duration_minutes FROM exams WHERE id = ? AND teacher_id = ?`, [id, teacher_id]);
        if (examCheck.length === 0) {
            return res.status(404).json({ message: "Exam not found or you don't have permission." });
        }
        const durationMinutes = normalizeDurationMinutes(duration_minutes, examCheck[0].duration_minutes);
        if (!durationMinutes) {
            return res.status(400).json({ message: "A valid exam duration in minutes is required." });
        }

        await connection.beginTransaction();

        // Update exam status to LIVE
        let updateQuery = `UPDATE exams SET status = 'LIVE', require_seb = ?, duration_minutes = ?`;
        const queryParams = [Boolean(require_seb), durationMinutes];
        
        if (start_time) {
            updateQuery += `, start_time = ?`;
            queryParams.push(start_time);
        }
        if (end_time) {
            updateQuery += `, end_time = ?`;
            queryParams.push(end_time);
        }
        
        updateQuery += ` WHERE id = ?`;
        queryParams.push(id);
        
        await connection.query(updateQuery, queryParams);

        // Delete existing group associations (if re-publishing)
        await connection.query(`DELETE FROM exam_groups WHERE exam_id = ?`, [id]);

        // Insert new group associations
        logDebug("publishExam received groupIds", groupIds);
        if (Array.isArray(groupIds) && groupIds.length > 0) {
            // Filter out any null or undefined group ids just in case
            const validGroupIds = groupIds.filter(gId => gId !== null && gId !== undefined && gId !== '');
            logDebug("publishExam validGroupIds", validGroupIds);
            if (validGroupIds.length > 0) {
                const groupValues = validGroupIds.map(gId => [id, gId]);
                logDebug("publishExam inserting values", groupValues);
                await connection.query(`INSERT INTO exam_groups (exam_id, group_id) VALUES ?`, [groupValues]);
                logDebug("publishExam insert success", { exam_id: id });
            }
        }

        await connection.commit();
        res.status(200).json({ message: "Exam published successfully." });
    } catch (error) {
        await connection.rollback();
        logDebug("publishExam Error", error.message);
        console.error("Error publishing exam:", error);
        res.status(500).json({ message: "Internal server error during exam publishing." });
    } finally {
        connection.release();
    }
};

// Fetch specific exam details including assigned groups
const getExamDetails = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id, 'exam id');
        const teacher_id = req.userId;
        const examAccess = await getTeacherExamAccess(id, teacher_id);
        if (!examAccess) {
            return res.status(404).json({ message: "Exam not found or unauthorized." });
        }

        // Fetch basic info from MySQL
        const query = `
            SELECT e.id, e.title, e.creation_date, e.status, e.duration_minutes, e.start_time, e.end_time, e.llm_provider_config_id, e.require_seb,
                   e.teacher_id,
                   m.name as module_name, m.abbreviation as module_abbreviation,
                   u.name as creator_name, u.lastname as creator_lastname, u.username as creator_username
            FROM exams e
            LEFT JOIN modules m ON e.module_id = m.id
            LEFT JOIN users u ON u.id = e.teacher_id
            WHERE e.id = ?
        `;
        const [examRes] = await pool.query(query, [id]);

        if (examRes.length === 0) {
            return res.status(404).json({ message: "Exam not found or unauthorized." });
        }

        const examData = examRes[0];
        const readiness = await getExamReadiness(id);
        examData.status = readiness?.exam?.status || examData.status;
        examData.statisticsReadiness = readiness ? {
            ready: readiness.ready,
            examEnded: readiness.examEnded,
            allSubmitted: readiness.allSubmitted,
            eligibleStudents: readiness.eligibleStudents,
            submittedStudents: readiness.submittedStudents,
            pendingStudents: readiness.pendingStudents,
        } : null;

        // Fetch assigned groups
        const groupsQuery = `
            SELECT sg.id, sg.name, sg.year 
            FROM exam_groups eg
            JOIN student_groups sg ON eg.group_id = sg.id
            WHERE eg.exam_id = ?
        `;
        const [groupsRes] = await pool.query(groupsQuery, [id]);
        
        examData.assignedGroups = groupsRes;

        // Fetch MongoDB data (questions etc)
        const mongoExam = await Exam.findById(id).lean();
        if (mongoExam && mongoExam.examData) {
            // Include question count and maybe total score if it was calculated
            examData.content = mongoExam.examData;
        } else {
            examData.content = null;
        }

        res.status(200).json(examData);

    } catch (error) {
        console.error("Error fetching exam details:", error);
        res.status(500).json({ message: "Server error fetching exam details." });
    }
};

// Unpublish an exam (change status to DRAFT)
const unpublishExam = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const teacher_id = req.userId;

        // Verify the exam belongs to the teacher
        const [examCheck] = await connection.query(`SELECT id FROM exams WHERE id = ? AND teacher_id = ?`, [id, teacher_id]);
        if (examCheck.length === 0) {
            return res.status(404).json({ message: "Exam not found or you don't have permission." });
        }

        await connection.beginTransaction();

        // Check if there are active exam sessions (Optional logic: prevent unpublishing if students are already taking it)
        const [sessionCheck] = await connection.query(`SELECT id FROM exam_sessions WHERE exam_id = ? AND status = 'ONGOING'`, [id]);
        if (sessionCheck.length > 0) {
            // Note: Decide whether to block this or allow it and invalidate sessions.
            // For now, allow it but maybe warn. Actually, problem asks to make it unavailable at any moment.
        }

        // Update exam status to CLOSED or DRAFT. Since it was published, maybe DRAFT or a new status? 
        // We'll set it to DRAFT so they can edit or publish later. Or CLOSED. Let's set it to DRAFT.
        await connection.query(`UPDATE exams SET status = 'DRAFT', start_time = NULL, end_time = NULL WHERE id = ?`, [id]);
        
        // Remove associations with groups?
        await connection.query(`DELETE FROM exam_groups WHERE exam_id = ?`, [id]);

        await connection.commit();
        res.status(200).json({ message: "Exam unpublished successfully." });
    } catch (error) {
        await connection.rollback();
        console.error("Error unpublishing exam:", error);
        res.status(500).json({ message: "Internal server error during exam unpublishing." });
    } finally {
        connection.release();
    }
};

// Update assigned groups for an exam
const updateExamGroups = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { groupIds } = req.body;
        const teacher_id = req.userId;

        // Verify the exam belongs to the teacher
        const [examCheck] = await connection.query(`SELECT id FROM exams WHERE id = ? AND teacher_id = ?`, [id, teacher_id]);
        if (examCheck.length === 0) {
            return res.status(404).json({ message: "Exam not found or you don't have permission." });
        }

        await connection.beginTransaction();

        // Delete existing group associations
        await connection.query(`DELETE FROM exam_groups WHERE exam_id = ?`, [id]);

        // Insert new group associations
        logDebug("updateExamGroups received groupIds:", groupIds);
        if (Array.isArray(groupIds) && groupIds.length > 0) {
            // Filter out any null or undefined group ids
            const validGroupIds = groupIds.filter(gId => gId !== null && gId !== undefined && gId !== '');
            logDebug("updateExamGroups validGroupIds:", validGroupIds);
            if (validGroupIds.length > 0) {
                const groupValues = validGroupIds.map(gId => [id, gId]);
                logDebug("updateExamGroups inserting values:", groupValues);
                await connection.query(`INSERT INTO exam_groups (exam_id, group_id) VALUES ?`, [groupValues]);
                logDebug("updateExamGroups insert success", { exam_id: id });
            } else {
                logDebug("No valid group IDs after filtering", { groupIds });
            }
        } else {
            logDebug("groupIds is empty or not an array:", groupIds);
        }

        await connection.commit();
        res.status(200).json({ message: "Exam groups updated successfully." });
    } catch (error) {
        await connection.rollback();
        logDebug("updateExamGroups Error", error.message);
        console.error("Error updating exam groups:", error);
        res.status(500).json({ message: "Internal server error updating exam groups." });
    } finally {
        connection.release();
    }
};

const exportResultsCsv = async (req, res) => {
    try {
        const examId = parsePositiveInt(req.params.id, 'exam id');
        const teacherId = req.userId;

        const examAccess = await getTeacherExamAccess(examId, teacherId);
        if (!examAccess) {
            return res.status(404).json({ message: 'Exam not found or unauthorized.' });
        }

        const statistics = await getStoredOrGenerateStatisticsSnapshot(examId, teacherId);
        if (!statistics?.ready) {
            return res.status(409).json({
                message: 'CSV export is available only after the exam has ended and all assigned students have submitted.',
                readiness: statistics?.readiness || null,
            });
        }

        const csvLines = ['student_id,username,name,rank,score,max_score,percentage_score,pass_status,correct_answers,partial_answers,incorrect_answers,percentile,score_gap_to_average'];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="exam-${examId}-results.csv"`);
        res.write(`${csvLines[0]}\n`);
        statistics.payload.students.forEach((student) => {
            const line = [
                student.student_id,
                `"${String(student.username || '').replace(/"/g, '""')}"`,
                `"${String(student.name || '').replace(/"/g, '""')}"`,
                student.rank,
                student.score,
                student.max_score,
                student.percentage_score,
                student.pass_status,
                student.correct_answers,
                student.partial_answers,
                student.incorrect_answers,
                student.percentile,
                student.score_gap_to_average,
            ].join(',');
            res.write(`${line}\n`);
        });
        res.end();
    } catch (error) {
        console.error('Error exporting exam results CSV:', error);
        res.status(500).json({ message: 'Failed to export exam results.' });
    }
};

const getExamResults = async (req, res) => {
    try {
        const examId = parsePositiveInt(req.params.id, 'exam id');
        const teacherId = req.userId;
        const examAccess = await getTeacherExamAccess(examId, teacherId);

        if (!examAccess) {
            return res.status(404).json({ message: 'Exam not found or unauthorized.' });
        }

        const [rows] = await pool.query(
            `SELECT
                er.id AS result_id,
                er.student_id,
                er.score,
                er.max_score,
                er.percentage_score,
                er.pass_status,
                er.submitted_at,
                u.name,
                u.lastname,
                u.username,
                sg.name AS group_name,
                sg.year AS group_year,
                cd.id AS correction_document_id
             FROM exam_results er
             JOIN users u ON u.id = er.student_id
             LEFT JOIN students st ON st.id = er.student_id
             LEFT JOIN student_groups sg ON sg.id = st.group_id
             LEFT JOIN correction_documents cd ON cd.exam_result_id = er.id
             WHERE er.exam_id = ?
             ORDER BY er.score DESC, er.submitted_at ASC`,
            [examId]
        );

        res.status(200).json({
            exam: {
                id: examAccess.id,
                title: examAccess.title,
                module_name: examAccess.module_name,
                module_abbreviation: examAccess.module_abbreviation,
                status: examAccess.status,
            },
            results: rows.map((row) => ({
                ...row,
                student_name: `${row.name} ${row.lastname}`.trim(),
                correction_document_url: row.correction_document_id ? `/teacher/exams/${examId}/results/${row.result_id}/correction` : null,
            })),
        });
    } catch (error) {
        console.error('Error fetching exam results:', error);
        res.status(500).json({ message: 'Failed to fetch exam results.' });
    }
};

const viewResultCorrectionDocument = async (req, res) => {
    try {
        const examId = parsePositiveInt(req.params.id, 'exam id');
        const resultId = parsePositiveInt(req.params.resultId, 'result id');
        const teacherId = req.userId;
        const examAccess = await getTeacherExamAccess(examId, teacherId);

        if (!examAccess) {
            return res.status(404).json({ message: 'Exam not found or unauthorized.' });
        }

        const correctionDocument = await getCorrectionDocumentBundleByResultId({
            examResultId: resultId,
            examId,
            connection: pool,
        });

        if (!correctionDocument) {
            return res.status(404).json({ message: 'Correction document not found.' });
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(correctionDocument.html || buildCorrectionHtml(correctionDocument.payload));
    } catch (error) {
        console.error('Error rendering teacher correction document:', error);
        res.status(500).json({ message: 'Failed to render correction document.' });
    }
};

module.exports = {
    getTeacherExams,
    createExam,
    publishExam,
    unpublishExam,
    getExamDetails,
    updateExamGroups,
    exportResultsCsv,
    getExamResults,
    viewResultCorrectionDocument,
};
