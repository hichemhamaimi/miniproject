const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam');
const fs = require('fs');
const path = require('path');

const logDebug = (msg, data) => {
    const logPath = path.join(__dirname, '..', '..', 'debug_log.txt');
    const time = new Date().toISOString();
    const logLine = `[${time}] ${msg} : ${JSON.stringify(data, null, 2)}\n`;
    fs.appendFileSync(logPath, logLine);
};

// Fetch all exams created by the logged-in teacher
const getTeacherExams = async (req, res) => {
    try {
        const teacher_id = req.userId;
        
        // Fetch metadata from MySQL
        const query = `
            SELECT e.id, e.title, e.creation_date, e.module_id, e.status, e.duration_minutes, e.start_time, e.end_time, m.name as module_name, m.abbreviation as module_abbreviation
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

        // Merge data
        const mergedExams = mysqlExams.map(mysqlExam => {
            const mongoExam = mongoExams.find(m => m._id === mysqlExam.id);
            return {
                ...mysqlExam,
                examData: mongoExam ? mongoExam.examData : null
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
        const { title, module_id, duration_minutes, examData } = req.body;
        const teacher_id = req.userId;

        if (!title || !examData || examData.questions.length === 0) {
            return res.status(400).json({ message: "Title and at least one question in examData are required." });
        }

        // 1. MySQL Transaction
        await connection.beginTransaction();

        const insertQuery = `INSERT INTO exams (teacher_id, module_id, title, duration_minutes, status) VALUES (?, ?, ?, ?, 'DRAFT')`;
        // Execute the insert to get the Auto-Incremented ID
        const [result] = await connection.query(insertQuery, [teacher_id, module_id || null, title, duration_minutes || 60]);
        
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
        const { groupIds, start_time, end_time } = req.body;
        const teacher_id = req.userId;

        // Verify the exam belongs to the teacher
        const [examCheck] = await connection.query(`SELECT id FROM exams WHERE id = ? AND teacher_id = ?`, [id, teacher_id]);
        if (examCheck.length === 0) {
            return res.status(404).json({ message: "Exam not found or you don't have permission." });
        }

        await connection.beginTransaction();

        // Update exam status to LIVE
        let updateQuery = `UPDATE exams SET status = 'LIVE'`;
        const queryParams = [];
        
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
        const { id } = req.params;
        const teacher_id = req.userId;

        // Fetch basic info from MySQL
        const query = `
            SELECT e.id, e.title, e.creation_date, e.status, e.duration_minutes, e.start_time, e.end_time,
                   m.name as module_name, m.abbreviation as module_abbreviation
            FROM exams e
            LEFT JOIN modules m ON e.module_id = m.id
            WHERE e.id = ? AND e.teacher_id = ?
        `;
        const [examRes] = await pool.query(query, [id, teacher_id]);

        if (examRes.length === 0) {
            return res.status(404).json({ message: "Exam not found or unauthorized." });
        }

        const examData = examRes[0];

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

module.exports = {
    getTeacherExams,
    createExam,
    publishExam,
    unpublishExam,
    getExamDetails,
    updateExamGroups
};
