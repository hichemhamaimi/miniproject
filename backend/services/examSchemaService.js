const pool = require('../config/dbConnect');

const tableExists = async (tableName) => {
    const [rows] = await pool.query(
        `
            SELECT 1
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            LIMIT 1
        `,
        [tableName]
    );

    return rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
    const [rows] = await pool.query(
        `
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
            LIMIT 1
        `,
        [tableName, columnName]
    );

    return rows.length > 0;
};

const addColumnIfMissing = async (tableName, columnName, definition) => {
    if (!(await columnExists(tableName, columnName))) {
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
};

const ensureResultSchema = async () => {
    if (!(await tableExists('exam_results'))) {
        await pool.query(`
            CREATE TABLE exam_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                exam_id INT NOT NULL,
                score DECIMAL(10,2) NOT NULL,
                max_score DECIMAL(10,2) NOT NULL DEFAULT 0,
                percentage_score DECIMAL(6,2) NOT NULL DEFAULT 0,
                pass_status ENUM('PASS', 'FAIL') NOT NULL DEFAULT 'FAIL',
                session_id INT NULL,
                submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                correction_document_id INT NULL,
                INDEX idx_results_exam (exam_id),
                INDEX idx_results_student (student_id)
            )
        `);
    }

    await addColumnIfMissing('exam_results', 'max_score', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER score');
    await addColumnIfMissing('exam_results', 'percentage_score', 'DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER max_score');
    await addColumnIfMissing('exam_results', 'pass_status', "ENUM('PASS', 'FAIL') NOT NULL DEFAULT 'FAIL' AFTER percentage_score");
    await addColumnIfMissing('exam_results', 'session_id', 'INT NULL AFTER exam_id');
    await addColumnIfMissing('exam_results', 'correction_document_id', 'INT NULL AFTER submitted_at');

    if (!(await tableExists('question_results'))) {
        await pool.query(`
            CREATE TABLE question_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                exam_result_id INT NOT NULL,
                question_id VARCHAR(64) NOT NULL,
                selected_choice JSON NULL,
                is_correct TINYINT(1) NOT NULL DEFAULT 0,
                student_answer_json JSON NULL,
                correct_answer_json JSON NULL,
                awarded_score DECIMAL(10,2) NOT NULL DEFAULT 0,
                max_score DECIMAL(10,2) NOT NULL DEFAULT 0,
                grading_status ENUM('correct', 'partial', 'incorrect') NOT NULL DEFAULT 'incorrect',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_question_results_result (exam_result_id),
                INDEX idx_question_results_question (question_id)
            )
        `);
    }

    await addColumnIfMissing('question_results', 'student_answer_json', 'JSON NULL AFTER is_correct');
    await addColumnIfMissing('question_results', 'correct_answer_json', 'JSON NULL AFTER student_answer_json');
    await addColumnIfMissing('question_results', 'awarded_score', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER correct_answer_json');
    await addColumnIfMissing('question_results', 'max_score', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER awarded_score');
    await addColumnIfMissing('question_results', 'grading_status', "ENUM('correct', 'partial', 'incorrect') NOT NULL DEFAULT 'incorrect' AFTER max_score");
    await addColumnIfMissing('question_results', 'created_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER grading_status');
};

const initExamSchema = async () => {
    try {
        await pool.query(`
            ALTER TABLE exams
            MODIFY COLUMN status ENUM('DRAFT', 'READY', 'LIVE', 'ENDED', 'CLOSED') NOT NULL DEFAULT 'DRAFT'
        `);
        await ensureResultSchema();
        console.log('[Exam Config] Exam lifecycle and result schemas ensured.');
    } catch (error) {
        console.error('[Exam Config] Failed to ensure exam lifecycle schema:', error);
    }
};

module.exports = {
    initExamSchema,
};
