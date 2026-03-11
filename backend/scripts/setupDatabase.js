require('dotenv').config();
const pool = require('../config/dbConnect');

const setupDatabase = async () => {
    try {
        const createExamsTableQuery = `
            CREATE TABLE IF NOT EXISTS exams (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_id INT NOT NULL,
                module_id INT,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await pool.query(createExamsTableQuery);
        console.log('Exams table checked/created successfully.');
    } catch (err) {
        console.error('Error creating exams table:', err);
    } finally {
        // Exit process since we just want to run this once
        process.exit();
    }
};

setupDatabase();
