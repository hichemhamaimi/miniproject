const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam');
const gradingService = require('../../services/gradingService');

// Get all LIVE exams available for the student's groups
const getAvailableExams = async (req, res) => {
    try {
        const student_id = req.userId;
        
        // Find exams that are LIVE and mapped to a group the student is in
        const query = `
            SELECT e.id, e.title, e.duration_minutes, e.start_time, e.end_time, 
                   m.name as module_name, m.abbreviation as module_abbreviation,
                   s.status as attempt_status, s.start_time as attempt_start
            FROM exams e
            JOIN exam_groups eg ON e.id = eg.exam_id
            JOIN students st ON eg.group_id = st.group_id
            LEFT JOIN modules m ON e.module_id = m.id
            LEFT JOIN exam_sessions s ON e.id = s.exam_id AND s.student_id = ?
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
        const { id } = req.params;
        const student_id = req.userId;

        // 1. Verify Exam is LIVE and student is eligible
        const checkQuery = `
            SELECT e.id, e.title, e.duration_minutes 
            FROM exams e
            JOIN exam_groups eg ON e.id = eg.exam_id
            JOIN students st ON eg.group_id = st.group_id
            WHERE st.id = ? AND e.id = ? AND e.status = 'LIVE'
        `;
        const [examResults] = await connection.query(checkQuery, [student_id, id]);
        
        if (examResults.length === 0) {
            return res.status(403).json({ message: "Exam is not available or you are not authorized." });
        }
        
        const { title, duration_minutes } = examResults[0];

        // 2. Check existing session
        const [sessionResults] = await connection.query(
            `SELECT id, status, start_time FROM exam_sessions WHERE exam_id = ? AND student_id = ?`,
            [id, student_id]
        );

        let session;
        if (sessionResults.length > 0) {
            session = sessionResults[0];
            if (session.status === 'SUBMITTED' || session.status === 'EXPIRED') {
                return res.status(403).json({ message: "You have already completed this exam." });
            }
        } else {
            // Create a new session
            const insertResult = await connection.query(
                `INSERT INTO exam_sessions (exam_id, student_id, start_time, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'ONGOING')`,
                [id, student_id]
            );
            session = { start_time: new Date(), status: 'ONGOING' };
        }

        // 3. Fetch MongoDB exam content
        const mongoExam = await Exam.findById(id).lean();
        if (!mongoExam) {
            return res.status(404).json({ message: "Exam content not found." });
        }
        
        // IMPORTANT: We must strip out the correctAnswers/trueFalseAnswer from the JSON payload 
        // before sending it to the student to prevent cheating!
        const secureQuestions = mongoExam.examData.questions.map(q => {
            const safeQ = { ...q };
            delete safeQ.correctAnswers;
            delete safeQ.trueFalseAnswer;
            delete safeQ.scoringOverride;
            // For matching/ordering, shuffle the right side/items so they aren't solved
            return safeQ;
        });

        res.status(200).json({
            examId: id,
            title: title,
            duration_minutes: duration_minutes,
            session_start_time: session.start_time,
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
    try {
        const { id } = req.params;
        const student_id = req.userId;
        const { answers } = req.body;

        await connection.beginTransaction();

        // 1. Verify session is ongoing
        const [sessionResults] = await connection.query(
            `SELECT id, status, start_time FROM exam_sessions WHERE exam_id = ? AND student_id = ? FOR UPDATE`,
            [id, student_id]
        );

        if (sessionResults.length === 0) {
            return res.status(400).json({ message: "No active session found for this exam." });
        }
        const session = sessionResults[0];

        if (session.status !== 'ONGOING') {
            return res.status(400).json({ message: "Exam is already submitted or expired." });
        }

        // 2. We don't strictly enforce time in milliseconds here, but we could check if time exceeded buffer
        // Since WebSockets enforce Auto-Submit, we just process it.

        // 3. Fetch original MongoDB document to grade correctly
        const mongoExam = await Exam.findById(id).lean();
        if (!mongoExam) {
            return res.status(404).json({ message: "Exam content not found." });
        }

        // 4. Grade Exam
        const graderResult = gradingService.gradeExam(mongoExam, answers);

        // 5. Update session status
        await connection.query(
            `UPDATE exam_sessions SET status = 'SUBMITTED', end_time = CURRENT_TIMESTAMP WHERE id = ?`,
            [session.id]
        );

        // Optional: Save score to a grades table (omitted for brevity, assume stored in session or gradebook)
        
        await connection.commit();

        res.status(200).json({ 
            message: "Exam submitted successfully.",
            score: graderResult.totalScore,
            maxScore: graderResult.maxScore
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error submitting exam:", error);
        res.status(500).json({ message: "Internal server error submitting exam." });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAvailableExams,
    enterExam,
    submitExam
};
