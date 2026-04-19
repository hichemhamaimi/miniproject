const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam'); 

const getStudentResults = async (req, res) => {
    try {
        const student_id = req.userId;

        const [results] = await pool.query(`
            SELECT 
                er.id as result_id,
                er.score,
                er.submitted_at,
                e.title as exam_title,
                e.id as exam_id,
                m.name as module_name
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            LEFT JOIN modules m ON e.module_id = m.id
            WHERE er.student_id = ?
            ORDER BY er.submitted_at DESC
        `, [student_id]);

        res.status(200).json(results);
    } catch (error) {
        console.error("Error fetching student results:", error);
        res.status(500).json({ message: "Server error fetching results." });
    }
};

const getStudentResultDetails = async (req, res) => {
    try {
        const { id } = req.params; // Result ID
        const student_id = req.userId;

        const [resultCheck] = await pool.query(`
            SELECT exam_id, score, submitted_at 
            FROM exam_results 
            WHERE id = ? AND student_id = ?
        `, [id, student_id]);

        if (resultCheck.length === 0) {
            return res.status(404).json({ message: "Result not found or unauthorized." });
        }

        const resultInfo = resultCheck[0];

        const [questionResults] = await pool.query(`
            SELECT question_id, selected_choice, is_correct
            FROM question_results
            WHERE exam_result_id = ?
        `, [id]);

        const mongoExam = await Exam.findById(resultInfo.exam_id).lean();

        res.status(200).json({
            score: resultInfo.score,
            submitted_at: resultInfo.submitted_at,
            examData: mongoExam ? mongoExam.examData : null,
            answers: questionResults.map(qr => ({
                question_id: qr.question_id,
                selected_choice: JSON.parse(qr.selected_choice),
                is_correct: qr.is_correct === 1
            }))
        });

    } catch (error) {
        console.error("Error fetching result details:", error);
        res.status(500).json({ message: "Server error fetching result details." });
    }
};

module.exports = {
    getStudentResults,
    getStudentResultDetails
};
