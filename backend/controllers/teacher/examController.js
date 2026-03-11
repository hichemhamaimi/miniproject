const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam');

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
    // We attempt an insertion in MySQL first
    // Then we use that ID for MongoDB
    const connection = await pool.getConnection();
    
    try {
        const { title, module_id, examData, duration_minutes } = req.body;
        const teacher_id = req.userId;

        if (!title || !examData) {
            return res.status(400).json({ message: "Title and examData are required." });
        }

        // 1. MySQL Transaction
        await connection.beginTransaction();

        const insertQuery = `INSERT INTO exams (teacher_id, module_id, title, duration_minutes, status) VALUES (?, ?, ?, ?, 'DRAFT')`;
        const [result] = await connection.query(insertQuery, [teacher_id, module_id || null, title, duration_minutes || 60]);
        
        const sqlInsertId = result.insertId;

        // 2. MongoDB Insertion
        const newExamDocument = new Exam({
            _id: sqlInsertId,
            examData: examData
        });

        await newExamDocument.save();

        // If mongo succeeds, commit MySQL transaction
        await connection.commit();

        res.status(201).json({
            message: "Exam created successfully",
            examId: sqlInsertId
        });

    } catch (error) {
        // If anything fails (including mongoose validation), rollback MySQL
        await connection.rollback();
        console.error("Error creating exam:", error);
        res.status(500).json({ message: "Internal server error during exam creation" });
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
        if (groupIds && groupIds.length > 0) {
            const groupValues = groupIds.map(gId => [id, gId]);
            await connection.query(`INSERT INTO exam_groups (exam_id, group_id) VALUES ?`, [groupValues]);
        }

        await connection.commit();
        res.status(200).json({ message: "Exam published successfully." });
    } catch (error) {
        await connection.rollback();
        console.error("Error publishing exam:", error);
        res.status(500).json({ message: "Internal server error during exam publishing." });
    } finally {
        connection.release();
    }
};

module.exports = {
    getTeacherExams,
    createExam,
    publishExam
};
