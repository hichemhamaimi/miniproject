const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam');
const gradingService = require('../../services/gradingService');
const { createCorrectionDocument } = require('../../services/correctionDocumentService');
const AppError = require('../../utils/AppError');
const { parsePositiveInt } = require('../../utils/validation');
const { generateSebAccessToken, generateSebSessionTransferToken } = require('../../utils/sebAccess');
const runtimeConfig = require('../../config/runtime.config');
const devLogger = require('../../utils/devLogger');
const {
    getSessionDeadlineMs,
    getRemainingSessionMs,
    canFinalizeExpiredSession,
    canAutoSubmitAfterDeadline,
} = require('../../utils/examSession');

const escapeXml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const createSubmitAttemptId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const logSubmit = (attemptId, event, payload = {}) => {
    devLogger.log('EXAM_SUBMIT', event, {
        attemptId,
        ...payload,
    });
};

// Get all LIVE exams available for the student's groups
const getAvailableExams = async (req, res) => {
    try {
        const student_id = req.userId;
        
        // Find exams that are LIVE and mapped to a group the student is in
        // Use a subquery to avoid duplicates when multiple click / sessions exist
        const query = `
            SELECT e.id, e.title, e.duration_minutes, e.start_time, e.end_time, 
                   e.require_seb,
                   m.name as module_name, m.abbreviation as module_abbreviation,
                   s.status as attempt_status, s.start_time as attempt_start
            FROM exams e
            JOIN exam_groups eg ON e.id = eg.exam_id
            JOIN students st ON eg.group_id = st.group_id
            LEFT JOIN modules m ON e.module_id = m.id
            LEFT JOIN (
                SELECT exam_id, student_id, status, start_time 
                FROM exam_sessions 
                WHERE id IN (
                    SELECT MAX(id) FROM exam_sessions GROUP BY exam_id, student_id
                )
            ) s ON e.id = s.exam_id AND s.student_id = ?
            WHERE st.id = ? AND e.status = 'LIVE'
            ORDER BY e.start_time ASC
        `;
        
        const [exams] = await pool.query(query, [student_id, student_id]);
        res.status(200).json(exams);
    } catch (error) {
        console.error("Error fetching available exams:", error);
        res.status(500).json({ message: "Server error fetching exams." });
    }
};

// Enter the exam room (Start session)
const enterExam = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const id = parsePositiveInt(req.params.id, 'exam id');
        const student_id = req.userId;

        // 1. Verify Exam is LIVE and student is eligible
        const checkQuery = `
            SELECT e.id, e.title, e.duration_minutes, e.start_time, e.end_time
            FROM exams e
            JOIN exam_groups eg ON e.id = eg.exam_id
            JOIN students st ON eg.group_id = st.group_id
            WHERE st.id = ? AND e.id = ? AND e.status = 'LIVE'
        `;
        const [examResults] = await connection.query(checkQuery, [student_id, id]);
        
        if (examResults.length === 0) {
            return res.status(403).json({ message: "Exam is not available or you are not authorized." });
        }
        
        const examMeta = examResults[0];
        const { title, duration_minutes, start_time, end_time } = examMeta;

        // Ensure current time is within exam bounds
        const now = new Date();
        if (start_time && now < new Date(start_time)) {
            return res.status(403).json({ message: "This exam has not started yet." });
        }
        if (end_time && now > new Date(end_time)) {
            return res.status(403).json({ message: "This exam has already ended." });
        }

        // 2. Check existing session
        const [sessionResults] = await connection.query(
            `SELECT id, status, start_time FROM exam_sessions WHERE exam_id = ? AND student_id = ? ORDER BY id DESC`,
            [id, student_id]
        );

        let session;
        if (sessionResults.length > 0) {
            // Find an ongoing session first (to recover from multi-click duplicates)
            session = sessionResults.find(s => s.status === 'ONGOING') || sessionResults[0];
            if (session.status === 'SUBMITTED') {
                return res.status(403).json({ message: "You have already completed this exam." });
            }
        } else {
            // Create a new session
            const [insertResult] = await connection.query(
                `INSERT INTO exam_sessions (exam_id, student_id, start_time, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'ONGOING')`,
                [id, student_id]
            );
            const [newSessionRows] = await connection.query(
                `SELECT id, status, start_time FROM exam_sessions WHERE id = ? LIMIT 1`,
                [insertResult.insertId]
            );
            session = newSessionRows[0];
        }

        if (session.status === 'EXPIRED') {
            return res.status(403).json({ message: "Your time for this exam has expired." });
        }

        const deadlineMs = getSessionDeadlineMs(session, examMeta);
        if (!deadlineMs) {
            return res.status(500).json({ message: "Exam duration is not configured correctly." });
        }

        if (Date.now() > deadlineMs) {
            await connection.query(
                `UPDATE exam_sessions SET status = 'EXPIRED', end_time = ? WHERE id = ? AND status = 'ONGOING'`,
                [new Date(deadlineMs), session.id]
            );
            return res.status(403).json({ message: "Your time for this exam has expired." });
        }

        // 3. Fetch MongoDB exam content
        const mongoExam = await Exam.findById(id).lean();
        if (!mongoExam) {
            return res.status(404).json({ message: "Exam content not found." });
        }
        
        // IMPORTANT: We must strip out the correctAnswers/trueFalseAnswer from the JSON payload 
        // before sending it to the student to prevent cheating!
        const secureQuestions = mongoExam.examData?.questions?.map(q => {
            const safeQ = { ...q };
            delete safeQ.correctAnswers;
            delete safeQ.trueFalseAnswer;
            delete safeQ.scoringOverride;
            
            // For matching/ordering, shuffle the right side/items so they aren't solved
            if (safeQ.type === 'ordering') {
                safeQ.orderedItems = safeQ.orderedItems ? [...safeQ.orderedItems].sort(() => Math.random() - 0.5) : [];
            }
            if (safeQ.type === 'matching') {
                const pairs = safeQ.matchingPairs || [];
                const scrambledRights = pairs.map(p => p.right || '').sort(() => Math.random() - 0.5);
                safeQ.matchingPairs = pairs.map((p, i) => ({
                    left: p.left || '',
                    right: scrambledRights[i]
                }));
            }
            return safeQ;
        }) || [];

        res.status(200).json({
            examId: id,
            title: title,
            duration_minutes: duration_minutes,
            session_start_time: session.start_time,
            remaining_ms: getRemainingSessionMs(session, examMeta),
            expires_at: new Date(deadlineMs).toISOString(),
            examData: {
                ...mongoExam.examData,
                questions: secureQuestions
            }
        });

    } catch (error) {
        console.error("Error entering exam:", error);
        res.status(500).json({ message: "Internal server error connecting to exam." });
    } finally {
        connection.release();
    }
};

// Map student's answer submission and grade it
const submitExam = async (req, res) => {
    const connection = await pool.getConnection();
    const submitAttemptId = req.headers['x-submit-attempt-id'] || createSubmitAttemptId();
    let transactionStarted = false;
    try {
        const id = parsePositiveInt(req.params.id, 'exam id');
        const student_id = req.userId;
        const { answers } = req.body;
        const isAutoSubmitRequest = String(req.headers['x-exam-auto-submit'] || '').toLowerCase() === 'true';

        logSubmit(submitAttemptId, 'Submit request received', {
            examId: id,
            studentId: student_id,
            role: req.role,
            username: req.username,
            autoSubmit: isAutoSubmitRequest,
            answerCount: Array.isArray(answers) ? answers.length : null,
            userAgent: req.headers['user-agent'],
        });

        if (!Array.isArray(answers)) {
            throw new AppError(400, 'answers must be an array.');
        }

        await connection.beginTransaction();
        transactionStarted = true;
        logSubmit(submitAttemptId, 'Transaction started', { examId: id, studentId: student_id });

        // 1. Verify session is ongoing
        const [sessionResults] = await connection.query(
            `SELECT id, status, start_time, end_time FROM exam_sessions WHERE exam_id = ? AND student_id = ? ORDER BY id DESC FOR UPDATE`,
            [id, student_id]
        );

        if (sessionResults.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            logSubmit(submitAttemptId, 'Rejected: no active session', { examId: id, studentId: student_id });
            return res.status(400).json({ message: "No active session found for this exam." });
        }
        const session = sessionResults.find(s => s.status === 'ONGOING') || sessionResults[0];
        logSubmit(submitAttemptId, 'Session loaded', {
            sessionId: session.id,
            sessionStatus: session.status,
            sessionStartTime: session.start_time,
            sessionEndTime: session.end_time,
        });

        // 2. Fetch exam metadata and enforce the exam/session deadline on the server.
        const [examMetaRows] = await connection.query(
            'SELECT id, title, status, pass_score, duration_minutes, start_time, end_time FROM exams WHERE id = ? LIMIT 1',
            [id]
        );
        if (examMetaRows.length === 0) {
            throw new AppError(404, 'Exam not found.');
        }
        const examMeta = examMetaRows[0];
        logSubmit(submitAttemptId, 'Exam metadata loaded', {
            examStatus: examMeta.status,
            durationMinutes: examMeta.duration_minutes,
            startTime: examMeta.start_time,
            endTime: examMeta.end_time,
        });

        if (session.status !== 'ONGOING' && !canFinalizeExpiredSession(session, isAutoSubmitRequest)) {
            await connection.rollback();
            transactionStarted = false;
            logSubmit(submitAttemptId, 'Rejected: session not ongoing/expired grace denied', {
                sessionId: session.id,
                sessionStatus: session.status,
                autoSubmit: isAutoSubmitRequest,
            });
            return res.status(400).json({ message: "Exam is already submitted or expired." });
        }

        if (session.status === 'ONGOING') {
            const deadlineMs = getSessionDeadlineMs(session, examMeta);
            if (!deadlineMs) {
                throw new AppError(500, 'Exam duration is not configured correctly.');
            }

            const nowMs = Date.now();
            if (examMeta.status !== 'LIVE' && nowMs <= deadlineMs) {
                await connection.rollback();
                transactionStarted = false;
                logSubmit(submitAttemptId, 'Rejected: exam no longer live before deadline', {
                    examStatus: examMeta.status,
                    deadline: new Date(deadlineMs).toISOString(),
                });
                return res.status(403).json({ message: "This exam is no longer accepting submissions." });
            }

            if (nowMs > deadlineMs) {
                await connection.query(
                    `UPDATE exam_sessions SET status = 'EXPIRED', end_time = ? WHERE id = ? AND status = 'ONGOING'`,
                    [new Date(deadlineMs), session.id]
                );

                if (!canAutoSubmitAfterDeadline(session, examMeta, isAutoSubmitRequest, nowMs)) {
                    await connection.commit();
                    transactionStarted = false;
                    logSubmit(submitAttemptId, 'Rejected: deadline passed without auto-submit grace', {
                        deadline: new Date(deadlineMs).toISOString(),
                        autoSubmit: isAutoSubmitRequest,
                    });
                    return res.status(403).json({ message: "The submission deadline has passed." });
                }
            }
        }

        // 3. Fetch original MongoDB document to grade correctly
        const mongoExam = await Exam.findById(id).lean();
        if (!mongoExam) {
            await connection.rollback();
            transactionStarted = false;
            logSubmit(submitAttemptId, 'Rejected: Mongo exam content missing', { examId: id });
            return res.status(404).json({ message: "Exam content not found." });
        }
        logSubmit(submitAttemptId, 'Mongo exam content loaded', {
            questionCount: mongoExam.examData?.questions?.length || 0,
        });

        // 4. Grade Exam
        const graderResult = gradingService.gradeExam(mongoExam, answers);
        logSubmit(submitAttemptId, 'Exam graded', {
            totalScore: graderResult.totalScore,
            maxScore: graderResult.maxScore,
            gradedQuestionCount: graderResult.gradedQuestions?.length || 0,
        });

        // 5. Update session status
        const [existingResultRows] = await connection.query(
            'SELECT id FROM exam_results WHERE session_id = ? LIMIT 1',
            [session.id]
        );
        if (existingResultRows.length > 0) {
            await connection.rollback();
            transactionStarted = false;
            logSubmit(submitAttemptId, 'Rejected: session already graded', {
                sessionId: session.id,
                existingResultId: existingResultRows[0].id,
            });
            return res.status(409).json({ message: 'This exam session has already been graded.' });
        }

        await connection.query(
            `UPDATE exam_sessions
             SET status = 'SUBMITTED',
                 end_time = COALESCE(end_time, CURRENT_TIMESTAMP)
             WHERE id = ?`,
            [session.id]
        );
        logSubmit(submitAttemptId, 'Session marked submitted', { sessionId: session.id });

        // 6. Save score to `exam_results` and `question_results`
        const percentageScore = graderResult.maxScore > 0
            ? Number(((graderResult.totalScore / graderResult.maxScore) * 100).toFixed(2))
            : 0;
        const passThreshold = examMeta.pass_score ?? Math.max(graderResult.maxScore / 2, 0);
        const passStatus = graderResult.totalScore >= passThreshold ? 'PASS' : 'FAIL';

        const [insertResultRes] = await connection.query(
            `INSERT INTO exam_results
             (student_id, exam_id, score, max_score, percentage_score, pass_status, session_id, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [student_id, id, graderResult.totalScore, graderResult.maxScore, percentageScore, passStatus, session.id]
        );
        const examResultId = insertResultRes.insertId;
        logSubmit(submitAttemptId, 'Exam result inserted', {
            examResultId,
            percentageScore,
            passStatus,
        });

        if (graderResult.gradedQuestions && graderResult.gradedQuestions.length > 0) {
            const qrValues = graderResult.gradedQuestions.map(d => [
                examResultId, 
                d.questionId, 
                JSON.stringify(d.studentAnswer ?? null),
                d.isCorrect ? 1 : 0,
                JSON.stringify(d.studentAnswer ?? null),
                JSON.stringify(d.correctAnswer ?? null),
                d.score,
                d.maxScore,
                d.status,
            ]);
            
            await connection.query(
                `INSERT INTO question_results
                 (exam_result_id, question_id, selected_choice, is_correct, student_answer_json, correct_answer_json, awarded_score, max_score, grading_status)
                 VALUES ?`,
                [qrValues]
            );
            logSubmit(submitAttemptId, 'Question results inserted', {
                examResultId,
                questionResultCount: qrValues.length,
            });
        }

        const correctionDocument = await createCorrectionDocument({
            examResultId,
            exam: { title: examMeta.title },
            studentId: student_id,
            examId: id,
            submittedAt: new Date(),
            score: graderResult.totalScore,
            maxScore: graderResult.maxScore,
            passStatus,
            questions: (mongoExam.examData?.questions || []).map((question) => {
                const graded = graderResult.gradedQuestions.find((item) => item.questionId === question.id) || {};
                return {
                    question_id: question.id,
                    text: question.text,
                    student_answer: graded.studentAnswer ?? null,
                    correct_answer: graded.correctAnswer ?? null,
                    awarded_score: graded.score ?? 0,
                    max_score: graded.maxScore ?? 0,
                    status: graded.status ?? 'incorrect',
                    explanation: question.explanation || '',
                };
            }),
            connection,
        });
        logSubmit(submitAttemptId, 'Correction document created', {
            examResultId,
            correctionDocumentId: correctionDocument?.id,
            mongoDocumentId: correctionDocument?.mongoDocumentId,
        });
        
        await connection.commit();
        transactionStarted = false;
        logSubmit(submitAttemptId, 'Submit committed successfully', {
            examResultId,
            correctionDocumentId: correctionDocument?.id,
        });

        res.status(200).json({ 
            message: "Exam submitted successfully.",
            submitAttemptId,
            score: graderResult.totalScore,
            maxScore: graderResult.maxScore,
            passStatus,
            correctionDocument,
        });

    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                logSubmit(submitAttemptId, 'Rollback failed', {
                    message: rollbackError.message,
                    code: rollbackError.code,
                    sqlMessage: rollbackError.sqlMessage,
                });
            }
        }
        logSubmit(submitAttemptId, 'Submit failed', {
            message: error.message,
            name: error.name,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            stack: error.stack,
        });
        console.error(`[ExamSubmit:${submitAttemptId}] Error submitting exam:`, error);
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message, submitAttemptId });
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This exam session was already submitted.', submitAttemptId });
        }
        const responsePayload = {
            message: "Internal server error submitting exam.",
            submitAttemptId,
        };
        if (process.env.NODE_ENV !== 'production') {
            responsePayload.error = error.message;
            responsePayload.code = error.code;
            responsePayload.sqlMessage = error.sqlMessage;
        }
        res.status(500).json(responsePayload);
    } finally {
        connection.release();
    }
};

// Download SEB file configuration
const downloadSebFile = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id, 'exam id');
        const student_id = req.userId;

        // Verify exam belongs to student's group
        const checkQuery = `
            SELECT e.id, e.title, e.start_time, e.end_time, e.require_seb, u.username, u.role
            FROM exams e
            JOIN exam_groups eg ON e.id = eg.exam_id
            JOIN students st ON eg.group_id = st.group_id
            JOIN users u ON u.id = st.id
            WHERE st.id = ? AND e.id = ?
        `;
        const [examResults] = await pool.query(checkQuery, [student_id, id]);
        
        if (examResults.length === 0) {
            return res.status(403).json({ message: "Exam not found or not authorized." });
        }

        const { title: examTitle, start_time, end_time, username, role } = examResults[0];

        const [existingResults] = await pool.query(
            `SELECT id
             FROM exam_results
             WHERE exam_id = ? AND student_id = ?
             LIMIT 1`,
            [id, student_id]
        );
        if (existingResults.length > 0) {
            return res.status(403).json({ message: "You have already completed this exam and can no longer download the SEB file." });
        }

        // Ensure current time is within exam bounds
        const now = new Date();
        if (start_time && now < new Date(start_time)) {
            return res.status(403).json({ message: "This exam has not started yet." });
        }
        if (end_time && now > new Date(end_time)) {
            return res.status(403).json({ message: "This exam has already ended." });
        }
        const sebToken = generateSebAccessToken({ examId: id, studentId: student_id });
        const sessionTransferToken = generateSebSessionTransferToken({
            examId: id,
            studentId: student_id,
            username,
            role,
        });
        const startUrl = `${runtimeConfig.frontendUrl}/student/exams/${id}?sebToken=${encodeURIComponent(sebToken)}&authTransfer=${encodeURIComponent(sessionTransferToken)}`;
        const quitUrl = `${runtimeConfig.frontendUrl}/student/dashboard?seb_quit=true`;

        const sebConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB_OSX_2.1.3</string>
    <key>startURL</key>
    <string>${escapeXml(startUrl)}</string>
    <key>sebServerURL</key>
    <string></string>
    <key>allowQuit</key>
    <true/>
    <key>enablePrintScreen</key>
    <true/>
    <key>allowScreenCapture</key>
    <true/>
    <key>allowWindowCapture</key>
    <true/>
    <key>blockScreenShotsLegacy</key>
    <false/>
    <key>quitURL</key>
    <string>${escapeXml(quitUrl)}</string>
</dict>
</plist>`;

        res.setHeader('Content-Type', 'application/seb');
        const filename = `${examTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.seb`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(sebConfig);

    } catch (error) {
        console.error("Error generating SEB file:", error);
        res.status(500).json({ message: "Internal server error generating SEB file." });
    }
};

module.exports = {
    getAvailableExams,
    enterExam,
    submitExam,
    downloadSebFile
};
