const pool = require('../config/dbConnect');

const columnDefinitions = [
    {
        name: 'mongo_document_id',
        definition: 'CHAR(24) NULL AFTER student_id',
    },
    {
        name: 'file_name',
        definition: "VARCHAR(255) NOT NULL DEFAULT 'exam-result.json' AFTER mongo_document_id",
    },
    {
        name: 'file_type',
        definition: "VARCHAR(100) NOT NULL DEFAULT 'application/json' AFTER file_name",
    },
    {
        name: 'document_payload',
        definition: 'LONGTEXT NULL AFTER file_type',
    },
    {
        name: 'created_at',
        definition: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER document_payload',
    },
];

const columnExists = async (columnName) => {
    const [rows] = await pool.query(
        `
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'correction_documents'
              AND COLUMN_NAME = ?
            LIMIT 1
        `,
        [columnName],
    );

    return rows.length > 0;
};

const normalizeLegacyColumns = async () => {
    if (await columnExists('storage_path')) {
        await pool.query(`
            ALTER TABLE correction_documents
            MODIFY COLUMN storage_path TEXT NULL
        `);
    }
};

const indexExists = async (indexName) => {
    const [rows] = await pool.query(
        `
            SELECT 1
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'correction_documents'
              AND INDEX_NAME = ?
            LIMIT 1
        `,
        [indexName],
    );

    return rows.length > 0;
};

const initCorrectionSchema = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS correction_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                exam_result_id INT NOT NULL,
                exam_id INT NOT NULL,
                student_id INT NOT NULL,
                mongo_document_id CHAR(24) NULL,
                file_name VARCHAR(255) NOT NULL,
                file_type VARCHAR(100) NOT NULL,
                document_payload LONGTEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_result_document (exam_result_id),
                INDEX idx_correction_mongo_document (mongo_document_id),
                CONSTRAINT fk_documents_result FOREIGN KEY (exam_result_id) REFERENCES exam_results(id) ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_documents_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_documents_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE
            )
        `);

        for (const column of columnDefinitions) {
            if (!(await columnExists(column.name))) {
                await pool.query(`ALTER TABLE correction_documents ADD COLUMN ${column.name} ${column.definition}`);
            }
        }

        await normalizeLegacyColumns();

        if (!(await indexExists('idx_correction_mongo_document'))) {
            await pool.query(`
                ALTER TABLE correction_documents
                ADD INDEX idx_correction_mongo_document (mongo_document_id)
            `);
        }

        console.log('[Correction Config] Correction document schema ensured.');
    } catch (error) {
        console.error('[Correction Config] Failed to ensure correction document schema:', error);
    }
};

module.exports = {
    initCorrectionSchema,
};
