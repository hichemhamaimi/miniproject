const pool = require('../../config/dbConnect');
const Exam = require('../../models/Exam'); 
const gradingService = require('../../services/gradingService');
const { parsePositiveInt } = require('../../utils/validation');
const { buildCorrectionHtml, getCorrectionDocumentBundleByResultId } = require('../../services/correctionDocumentService');

const safeJsonParse = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
};

const buildStudentSummary = (row = {}) => ({
    fullName: `${row.student_name || ''} ${row.student_lastname || ''}`.trim(),
    username: row.student_username || '',
    dateOfBirth: row.student_date_of_birth ? new Date(row.student_date_of_birth).toISOString().slice(0, 10) : '',
    groupLabel: row.group_name ? `${row.group_name}${row.group_year ? ` (${row.group_year})` : ''}` : '',
});

const buildModuleSummary = (row = {}) => ({
    label: row.module_name ? `${row.module_name}${row.module_abbreviation ? ` (${row.module_abbreviation})` : ''}` : '',
});

const getStudentResults = async (req, res) => {
    try {
        const student_id = req.userId;
        const [results] = await pool.query(`
            SELECT 
                er.id as result_id,
                er.score,
                er.max_score,
                er.percentage_score,
                er.pass_status,
                er.submitted_at,
                e.title as exam_title,
                m.name as module_name,
                er.correction_document_id
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.id
            LEFT JOIN modules m ON e.module_id = m.id
            WHERE er.student_id = ?
            ORDER BY er.submitted_at DESC
        `, [student_id]);

        res.status(200).json(results.map((result) => ({
            result_id: result.result_id,
            score: result.score,
            max_score: result.max_score,
            percentage_score: result.percentage_score,
            pass_status: result.pass_status,
            submitted_at: result.submitted_at,
            exam_title: result.exam_title,
            module_name: result.module_name,
            correction_document_url: result.correction_document_id ? `/student/results/${result.result_id}/document/view` : null,
        })));
    } catch (error) {
        console.error("Error fetching student results:", error);
        res.status(500).json({ message: "Server error fetching results." });
    }
};

const getStudentResultDetails = async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id, 'result id');
        const student_id = req.userId;

        const [resultCheck] = await pool.query(`
            SELECT
                er.exam_id,
                er.score,
                er.max_score,
                er.percentage_score,
                er.pass_status,
                er.submitted_at,
                er.correction_document_id,
                e.title AS exam_title,
                e.duration_minutes,
                m.name AS module_name,
                m.abbreviation AS module_abbreviation,
                u.name AS student_name,
                u.lastname AS student_lastname,
                u.username AS student_username,
                u.date_of_birth AS student_date_of_birth,
                sg.name AS group_name,
                sg.year AS group_year
            FROM exam_results er
            JOIN exams e ON e.id = er.exam_id
            JOIN users u ON u.id = er.student_id
            LEFT JOIN modules m ON m.id = e.module_id
            LEFT JOIN students st ON st.id = er.student_id
            LEFT JOIN student_groups sg ON sg.id = st.group_id
            WHERE er.id = ? AND er.student_id = ?
        `, [id, student_id]);

        if (resultCheck.length === 0) {
            return res.status(404).json({ message: "Result not found or unauthorized." });
        }

        const resultInfo = resultCheck[0];

        const [questionResults] = await pool.query(`
            SELECT question_id, selected_choice, is_correct, student_answer_json, correct_answer_json, awarded_score, max_score, grading_status
            FROM question_results
            WHERE exam_result_id = ?
        `, [id]);

        const mongoExam = await Exam.findById(resultInfo.exam_id).lean();
        const questionMap = new Map((mongoExam?.examData?.questions || []).map((question) => [question.id, question]));
        const correctionDocument = await getCorrectionDocumentBundleByResultId({
            examResultId: id,
            studentId: student_id,
            connection: pool,
        });

        res.status(200).json({
            score: resultInfo.score,
            max_score: resultInfo.max_score,
            percentage_score: resultInfo.percentage_score,
            pass_status: resultInfo.pass_status,
            submitted_at: resultInfo.submitted_at,
            student: buildStudentSummary(resultInfo),
            exam: {
                title: resultInfo.exam_title || '',
                durationMinutes: resultInfo.duration_minutes || null,
            },
            moduleInfo: buildModuleSummary(resultInfo),
            examData: mongoExam ? mongoExam.examData : null,
            correction_document: correctionDocument?.payload || null,
            correction_document_view_url: correctionDocument ? `/student/results/${id}/document/view` : null,
            answers: questionResults.map((qr) => {
                const question = questionMap.get(qr.question_id);
                const parsedCorrectAnswer = safeJsonParse(qr.correct_answer_json);
                const fallbackCorrectAnswer = question ? gradingService.getCanonicalCorrectAnswer(question) : null;
                return {
                    question_id: qr.question_id,
                    selected_choice: safeJsonParse(qr.selected_choice),
                    student_answer: safeJsonParse(qr.student_answer_json),
                    correct_answer: parsedCorrectAnswer ?? fallbackCorrectAnswer,
                    is_correct: qr.is_correct === 1,
                    awarded_score: qr.awarded_score,
                    max_score: qr.max_score,
                    grading_status: qr.grading_status,
                };
            })
        });

    } catch (error) {
        console.error("Error fetching result details:", error);
        res.status(500).json({ message: "Server error fetching result details." });
    }
};

const downloadCorrectionDocument = async (req, res) => {
    try {
        const resultId = parsePositiveInt(req.params.id, 'result id');
        const student_id = req.userId;
        const correctionDocument = await getCorrectionDocumentBundleByResultId({
            examResultId: resultId,
            studentId: student_id,
            connection: pool,
        });

        if (!correctionDocument) {
            return res.status(404).json({ message: 'Correction document not found.' });
        }

        res.status(200).json({
            fileName: correctionDocument.metadata.fileName,
            fileType: correctionDocument.metadata.fileType,
            source: correctionDocument.source,
            payload: correctionDocument.payload,
            viewUrl: `/student/results/${resultId}/document/view`,
        });
    } catch (error) {
        console.error("Error fetching correction document:", error);
        res.status(500).json({ message: "Server error fetching correction document." });
    }
};

const viewCorrectionDocument = async (req, res) => {
    try {
        const resultId = parsePositiveInt(req.params.id, 'result id');
        const student_id = req.userId;
        const correctionDocument = await getCorrectionDocumentBundleByResultId({
            examResultId: resultId,
            studentId: student_id,
            connection: pool,
        });

        if (!correctionDocument) {
            return res.status(404).json({ message: 'Correction document not found.' });
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(correctionDocument.html || buildCorrectionHtml(correctionDocument.payload));
    } catch (error) {
        console.error("Error rendering correction document:", error);
        res.status(500).json({ message: "Server error rendering correction document." });
    }
};

module.exports = {
    getStudentResults,
    getStudentResultDetails,
    downloadCorrectionDocument,
    viewCorrectionDocument,
};
