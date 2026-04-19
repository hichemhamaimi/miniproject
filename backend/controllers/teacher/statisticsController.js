const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam'); // To fetch actual question text if needed

const getExamStatistics = async (req, res) => {
    try {
        const { id } = req.params;
        const teacher_id = req.userId;

        // Verify exam belongs to teacher
        const [examCheck] = await pool.query(`SELECT id FROM exams WHERE id = ? AND teacher_id = ?`, [id, teacher_id]);
        if (examCheck.length === 0) {
            return res.status(404).json({ message: "Exam not found or unauthorized." });
        }

        // 1. General Stats
        const [generalStatsRes] = await pool.query(`
            SELECT 
                COUNT(*) as total_students,
                AVG(score) as average_score,
                MAX(score) as highest_score,
                MIN(score) as lowest_score
            FROM exam_results
            WHERE exam_id = ?
        `, [id]);

        const generalStats = generalStatsRes[0];
        
        // Pass rate (assume >= 10 is passing for a 20-point exam, but we might just use percentage)
        // Let's get max possible score to calculate pass rate correctly. For now we assume score > 0 is fine. Let's return raw scores.

        // 2. Question Stats
        const [questionStatsRes] = await pool.query(`
            SELECT 
                question_id,
                COUNT(*) as total_attempts,
                SUM(is_correct) as correct_count,
                (SUM(is_correct) / COUNT(*)) * 100 as correct_percentage
            FROM question_results qr
            JOIN exam_results er ON qr.exam_result_id = er.id
            WHERE er.exam_id = ?
            GROUP BY question_id
        `, [id]);

        // 3. Choices Stats (most selected wrong answer)
        const [choicesStatsRes] = await pool.query(`
            SELECT 
                question_id,
                selected_choice,
                COUNT(*) as selection_count
            FROM question_results qr
            JOIN exam_results er ON qr.exam_result_id = er.id
            WHERE er.exam_id = ? AND qr.is_correct = 0
            GROUP BY question_id, selected_choice
        `, [id]);

        // 4. Combine with question text from Mongo
        const mongoExam = await Exam.findById(id).lean();
        const questionsMap = {};
        if (mongoExam && mongoExam.examData && mongoExam.examData.questions) {
            mongoExam.examData.questions.forEach((q, idx) => {
                questionsMap[q.id] = {
                    text: q.question,
                    type: q.type,
                    index: idx + 1
                };
            });
        }

        // Aggregate per question details
        const questionsSummary = questionStatsRes.map(qStat => {
            const wrongChoices = choicesStatsRes.filter(c => c.question_id === qStat.question_id);
            wrongChoices.sort((a, b) => b.selection_count - a.selection_count);
            
            const mostSelectedWrong = wrongChoices.length > 0 ? wrongChoices[0].selected_choice : null;

            return {
                question_id: qStat.question_id,
                text: questionsMap[qStat.question_id] ? questionsMap[qStat.question_id].text : "Unknown Question",
                index: questionsMap[qStat.question_id] ? questionsMap[qStat.question_id].index : 0,
                total_attempts: qStat.total_attempts,
                correct_count: qStat.correct_count,
                correct_percentage: parseFloat(qStat.correct_percentage || 0).toFixed(2),
                difficulty_level: (qStat.correct_percentage < 30 ? 'Hard' : qStat.correct_percentage < 70 ? 'Medium' : 'Easy'),
                mostSelectedWrong: mostSelectedWrong ? JSON.parse(mostSelectedWrong) : null
            };
        });

        res.status(200).json({
            general: generalStats,
            questions: questionsSummary
        });

    } catch (error) {
        console.error("Error fetching exam statistics:", error);
        res.status(500).json({ message: "Server error fetching statistics." });
    }
};

module.exports = {
    getExamStatistics
};
