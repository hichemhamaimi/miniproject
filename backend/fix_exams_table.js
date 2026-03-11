require('dotenv').config();
const pool = require('./config/dbConnect');

async function fixExamsTable() {
    try {
        console.log("Adding title column to exams table...");
        await pool.query("ALTER TABLE exams ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Untitled';");
        console.log("Title column added successfully.");
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Title column already exists.");
        } else {
            console.error("Error altering exams table:", err);
        }
    } finally {
        await pool.end();
    }
}

fixExamsTable();
