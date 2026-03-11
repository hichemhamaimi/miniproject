require('dotenv').config();
const pool = require('./config/dbConnect');

async function runMigration() {
    try {
        console.log("Starting Migration...");

        // 1. Alter Exams table to add lifecycle fields
        console.log("Altering exams table...");
        try {
            const updateExamsQuery = `
                ALTER TABLE exams
                ADD COLUMN status ENUM('DRAFT', 'READY', 'LIVE', 'CLOSED') DEFAULT 'DRAFT',
                ADD COLUMN duration_minutes INT DEFAULT 60,
                ADD COLUMN start_time DATETIME DEFAULT NULL,
                ADD COLUMN end_time DATETIME DEFAULT NULL;
            `;
            await pool.query(updateExamsQuery);
            console.log("Exams table altered.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log("Columns already exist, skipping alter table.");
            } else {
                throw e;
            }
        }

        // 2. Create exam_groups table
        console.log("Creating exam_groups table...");
        const createExamGroupsQuery = `
            CREATE TABLE IF NOT EXISTS exam_groups (
                exam_id INT,
                group_id INT,
                PRIMARY KEY (exam_id, group_id),
                FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE
            );
        `;
        await pool.query(createExamGroupsQuery);
        console.log("exam_groups table created.");

        // 3. Create exam_sessions table
        console.log("Creating exam_sessions table...");
        const createExamSessionsQuery = `
            CREATE TABLE IF NOT EXISTS exam_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                exam_id INT,
                student_id INT,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME DEFAULT NULL,
                status ENUM('ONGOING', 'SUBMITTED', 'EXPIRED') DEFAULT 'ONGOING',
                FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `;
        await pool.query(createExamSessionsQuery);
        console.log("exam_sessions table created.");

        console.log("Migration completed successfully!");

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

runMigration();
