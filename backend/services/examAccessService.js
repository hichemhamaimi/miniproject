const pool = require('../config/dbConnect');

const getTeacherExamAccess = async (examId, teacherId) => {
    const [rows] = await pool.query(
        `SELECT
            e.id,
            e.title,
            e.teacher_id,
            e.module_id,
            e.status,
            m.name AS module_name,
            m.abbreviation AS module_abbreviation,
            m.responsable_teacher_id
         FROM exams e
         JOIN modules m ON m.id = e.module_id
         WHERE e.id = ?
         LIMIT 1`,
        [examId]
    );

    if (rows.length === 0) {
        return null;
    }

    const exam = rows[0];
    const canAccess = Number(exam.teacher_id) === Number(teacherId)
        || Number(exam.responsable_teacher_id) === Number(teacherId);

    if (!canAccess) {
        return null;
    }

    return exam;
};

module.exports = {
    getTeacherExamAccess,
};
