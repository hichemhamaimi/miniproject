const { v4: uuidv4 } = require('uuid');
const GeneratedExam = require('../../models/GeneratedExam');
const GenerationJob = require('../../models/GenerationJob');
const ExamBlueprint = require('../../models/ExamBlueprint');
const { enqueueExamGeneration } = require('../../services/queueService');
const { validateExam } = require('../../services/examValidator');
const config = require('../../config/system.config');
const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam');
const { sanitizeString } = require('../../utils/validation');

const buildExamForValidation = (title, questions = []) => ({
    examTitle: title,
    questions: questions.map((question) => ({
        type: question.type,
        difficulty: question.difficulty,
        question: question.text,
        options: question.options,
        correctAnswerIndexes: Array.isArray(question.correctAnswerIndexes) && question.correctAnswerIndexes.length > 0
            ? question.correctAnswerIndexes
            : (question.correctAnswers || [])
                .map((answer) => (question.options || []).findIndex((option) => option === answer))
                .filter((index) => index >= 0),
        correctAnswers: question.correctAnswers,
        trueFalseAnswer: question.trueFalseAnswer,
        matchingPairs: question.matchingPairs,
        orderedItems: question.orderedItems,
        explanation: question.explanation,
    })),
});

const validateGeneratedExamDraft = ({ title, questions }) => {
    if (!Array.isArray(questions) || questions.length === 0) {
        return { valid: false, errors: ['Exam must contain at least one question.'] };
    }

    return validateExam(buildExamForValidation(title, questions));
};

const getModuleGroupIds = async (moduleId) => {
    const [rows] = await pool.query(
        `SELECT sg.id
         FROM student_groups sg
         JOIN group_modules gm ON gm.group_id = sg.id
         WHERE gm.module_id = ?`,
        [moduleId]
    );
    return rows.map((row) => row.id);
};

const normalizeDurationMinutes = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildListingReadiness = (examRow = {}) => {
    const assignedStudents = Number(examRow.assigned_students || 0);
    const submittedStudents = Number(examRow.result_count || 0);
    const endTime = examRow.end_time ? new Date(examRow.end_time) : null;
    const timeEnded = Boolean(endTime) && endTime <= new Date();
    const storedStatus = String(examRow.status || '').toUpperCase();
    const examEnded = storedStatus === 'ENDED' || storedStatus === 'CLOSED' || timeEnded;
    const allSubmitted = assignedStudents > 0 && submittedStudents >= assignedStudents;
    const ready = examEnded && allSubmitted;
    const derivedStatus = storedStatus === 'LIVE' && ready ? 'ENDED' : storedStatus;

    return {
        status: derivedStatus || storedStatus,
        readiness: {
            ready,
            examEnded,
            allSubmitted,
            eligibleStudents: assignedStudents,
            submittedStudents,
            pendingStudentCount: Math.max(assignedStudents - submittedStudents, 0),
            pendingStudents: [],
        },
    };
};

// POST /teacher/ai-exams/generate
const generateExam = async (req, res) => {
    try {
        const { blueprintId } = req.body;
        if (!blueprintId) return res.status(400).json({ message: 'blueprintId is required.' });

        const blueprint = await ExamBlueprint.findOne({ _id: blueprintId, teacherId: req.userId });
        if (!blueprint) return res.status(404).json({ message: 'Blueprint not found.' });

        if (Object.prototype.hasOwnProperty.call(req.body, 'examProviderConfigId')) {
            blueprint.generationContext = {
                ...(blueprint.generationContext?.toObject?.() || blueprint.generationContext || {}),
                examProviderConfigId: req.body.examProviderConfigId ? Number(req.body.examProviderConfigId) : null,
            };
            await blueprint.save();
        }

        const jobDoc = await enqueueExamGeneration(blueprintId, req.userId);
        res.status(202).json({ message: 'Exam generation queued.', jobId: jobDoc._id });
    } catch (err) {
        console.error('Generate exam error:', err);
        res.status(500).json({ message: err.message || 'Failed to start generation.' });
    }
};

// GET /teacher/ai-exams/job/:jobId
const getJobStatus = async (req, res) => {
    try {
        const job = await GenerationJob.findOne({ _id: req.params.jobId, teacherId: req.userId });
        if (!job) return res.status(404).json({ message: 'Job not found.' });
        res.json({
            jobId: job._id,
            status: job.status,
            resultExamId: job.resultExamId || null,
            error: job.error || null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to get job status.' });
    }
};

// GET /teacher/ai-exams
const getExams = async (req, res) => {
    try {
        const exams = await GeneratedExam.find({ teacherId: req.userId })
            .sort({ createdAt: -1 })
            .lean();
        const moduleIds = [...new Set(exams.map((exam) => exam.moduleId).filter(Boolean))];
        let moduleMap = new Map();
        if (moduleIds.length > 0) {
            const [moduleRows] = await pool.query(
                `SELECT id, name, abbreviation
                 FROM modules
                 WHERE id IN (?)`,
                [moduleIds]
            );
            moduleMap = new Map(moduleRows.map((row) => [row.id, row]));
        }
        const publishedExamIds = exams.map((exam) => exam.publishedExamId).filter(Boolean);
        let publishedExamMap = new Map();
        if (publishedExamIds.length > 0) {
            const [rows] = await pool.query(
                `SELECT
                    e.id,
                    e.status,
                    e.start_time,
                    e.end_time,
                    e.duration_minutes,
                    e.require_seb,
                    COUNT(DISTINCT eg.group_id) AS group_count,
                    COUNT(DISTINCT st.id) AS assigned_students,
                    COUNT(DISTINCT er.id) AS result_count
                 FROM exams e
                 LEFT JOIN exam_groups eg ON eg.exam_id = e.id
                 LEFT JOIN students st ON st.group_id = eg.group_id
                 LEFT JOIN exam_results er ON er.exam_id = e.id
                 WHERE e.id IN (?)
                 GROUP BY e.id, e.status, e.start_time, e.end_time, e.duration_minutes, e.require_seb`,
                [publishedExamIds]
            );
            publishedExamMap = new Map(rows.map((row) => [row.id, row]));
        }
        res.json(exams.map((exam) => {
            const publishedExam = exam.publishedExamId ? publishedExamMap.get(exam.publishedExamId) || null : null;
            const listingState = publishedExam ? buildListingReadiness(publishedExam) : null;
            const moduleInfo = moduleMap.get(exam.moduleId) || null;
            const { questions = [], ...publicExam } = exam;
            return {
                ...publicExam,
                questionCount: questions.length,
                module: moduleInfo,
                publishedExam: publishedExam ? {
                    ...publishedExam,
                    status: listingState.status,
                } : null,
                statisticsReadiness: listingState?.readiness || null,
            };
        }));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch exams.' });
    }
};

const getArchivedExams = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                e.id,
                e.title,
                e.teacher_id,
                e.status,
                e.creation_date,
                e.duration_minutes,
                e.start_time,
                e.end_time,
                e.require_seb,
                e.pass_score,
                m.id AS module_id,
                m.name AS module_name,
                m.abbreviation AS module_abbreviation,
                u.name AS creator_name,
                u.lastname AS creator_lastname,
                u.username AS creator_username,
                COUNT(DISTINCT er.id) AS result_count,
                COUNT(DISTINCT cd.id) AS correction_count
             FROM exams e
             JOIN modules m ON m.id = e.module_id
             JOIN users u ON u.id = e.teacher_id
             LEFT JOIN exam_results er ON er.exam_id = e.id
             LEFT JOIN correction_documents cd ON cd.exam_id = e.id
             WHERE m.responsable_teacher_id = ?
               AND e.status IN ('LIVE', 'ENDED', 'CLOSED')
             GROUP BY
                e.id, e.title, e.teacher_id, e.status, e.creation_date, e.duration_minutes,
                e.start_time, e.end_time, e.require_seb, e.pass_score,
                m.id, m.name, m.abbreviation,
                u.name, u.lastname, u.username
             ORDER BY COALESCE(e.end_time, e.creation_date) DESC, e.creation_date DESC`,
            [req.userId]
        );

        res.json(rows.map((exam) => {
            const listingState = buildListingReadiness(exam);
            return {
                ...exam,
                status: listingState.status || exam.status,
                statisticsReadiness: listingState.readiness,
            };
        }).filter((exam) => exam.status === 'ENDED' || exam.status === 'CLOSED'));
    } catch (err) {
        console.error('Failed to fetch archived exams:', err);
        res.status(500).json({ message: 'Failed to fetch archived exams.' });
    }
};

// GET /teacher/ai-exams/:id
const getExam = async (req, res) => {
    try {
        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        res.json(exam);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch exam.' });
    }
};

// PUT /teacher/ai-exams/:id  — teacher edits exam
const updateExam = async (req, res) => {
    try {
        const { title, questions, scoringDefaults } = req.body;

        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (exam.status === 'published') return res.status(400).json({ message: 'Cannot edit a published exam.' });

        // Validate question count
        if (questions && questions.length > config.examGeneration.maxQuestions) {
            return res.status(400).json({
                message: `Cannot have more than ${config.examGeneration.maxQuestions} questions.`
            });
        }

        if (questions && questions.length > 0) {
            const validation = validateGeneratedExamDraft({
                title: title || exam.title,
                questions,
            });
            if (!validation.valid) {
                return res.status(400).json({ message: 'Validation failed.', errors: validation.errors });
            }
        }

        // Ensure all questions have an id
        const processedQuestions = (questions || exam.questions).map(q => ({
            ...q,
            id: q.id || uuidv4()
        }));

        const updated = await GeneratedExam.findByIdAndUpdate(
            req.params.id,
            {
                ...(title && { title }),
                ...(questions && { questions: processedQuestions }),
                ...(scoringDefaults && { scoringDefaults })
            },
            { new: true }
        );

        res.json(updated);
    } catch (err) {
        console.error('Update exam error:', err);
        res.status(500).json({ message: 'Failed to update exam.' });
    }
};

// POST /teacher/ai-exams/:id/publish
const publishExam = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (exam.status === 'published') return res.status(400).json({ message: 'Exam is already published.' });
        if (exam.questions.length === 0) return res.status(400).json({ message: 'Cannot publish an exam with no questions.' });
        const { groupIds, start_time, end_time, require_seb, duration_minutes } = req.body;
        const publishedTitle = req.body.title
            ? sanitizeString(req.body.title, { min: 2, max: 255, fieldName: 'exam title' })
            : exam.title;
        const validation = validateGeneratedExamDraft({
            title: publishedTitle,
            questions: exam.questions,
        });
        if (!validation.valid) {
            return res.status(400).json({ message: 'Exam validation failed before publishing.', errors: validation.errors });
        }
        if (!Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ message: 'At least one group is required to publish the exam.' });
        }
        const durationMinutes = normalizeDurationMinutes(duration_minutes);
        if (!durationMinutes) {
            return res.status(400).json({ message: 'A valid exam duration in minutes is required.' });
        }

        const allowedGroupIds = await getModuleGroupIds(exam.moduleId);
        const invalidGroup = groupIds.find((groupId) => !allowedGroupIds.includes(Number(groupId)));
        if (invalidGroup) {
            return res.status(400).json({ message: 'One or more selected groups do not belong to the exam module.' });
        }

        const defaultMaxScore = exam.questions.reduce(
            (sum, question) => sum + (question.scoringOverride?.active ? question.scoringOverride.correct || 1 : exam.scoringDefaults.correct || 1),
            0
        );
        const passScore = Number((defaultMaxScore * 0.5).toFixed(2));

        await connection.beginTransaction();

        const [insertResult] = await connection.query(
            `INSERT INTO exams
             (module_id, teacher_id, title, status, duration_minutes, start_time, end_time, pass_score)
             VALUES (?, ?, ?, 'LIVE', ?, ?, ?, ?)`,
            [
                exam.moduleId,
                req.userId,
                publishedTitle,
                durationMinutes,
                start_time || null,
                end_time || null,
                passScore,
            ]
        );
        const publishedExamId = insertResult.insertId;

        await connection.query(
            'UPDATE exams SET require_seb = ? WHERE id = ?',
            [Boolean(require_seb), publishedExamId]
        );

        await connection.query(
            'INSERT INTO exam_groups (exam_id, group_id) VALUES ?',
            [groupIds.map((groupId) => [publishedExamId, Number(groupId)])]
        );

        await Exam.create({
            _id: publishedExamId,
            examData: {
                scoringDefaults: exam.scoringDefaults,
                questions: exam.questions,
            }
        });

        const updated = await GeneratedExam.findByIdAndUpdate(
            req.params.id,
            { title: publishedTitle, status: 'published', publishedAt: new Date(), publishedExamId },
            { new: true }
        );

        await connection.commit();

        res.json({ message: 'Exam published successfully.', exam: updated, publishedExamId });
    } catch (err) {
        await connection.rollback();
        console.error('Failed to publish generated exam:', err);
        res.status(500).json({ message: err.message || 'Failed to publish exam.' });
    } finally {
        connection.release();
    }
};

// POST /teacher/ai-exams/:id/unpublish
const unpublishExam = async (req, res) => {
    try {
        const exam = await GeneratedExam.findOne({ _id: req.params.id, teacherId: req.userId });
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        if (exam.publishedExamId) {
            await pool.query(`UPDATE exams SET status = 'CLOSED', end_time = CURRENT_TIMESTAMP WHERE id = ?`, [exam.publishedExamId]);
        }

        const updated = await GeneratedExam.findByIdAndUpdate(
            req.params.id,
            { status: 'draft', publishedAt: null, publishedExamId: null },
            { new: true }
        );
        res.json({ message: 'Exam unpublished.', exam: updated });
    } catch (err) {
        res.status(500).json({ message: 'Failed to unpublish exam.' });
    }
};

module.exports = { generateExam, getJobStatus, getExams, getArchivedExams, getExam, updateExam, publishExam, unpublishExam };
