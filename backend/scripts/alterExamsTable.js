require('dotenv').config();
const pool = require('../config/dbConnect');

async function alterTable() {
    try {
        const [rows] = await pool.query("ALTER TABLE exams ADD COLUMN title VARCHAR(255) DEFAULT 'Untitled'");
        console.log('Table altered successfully.');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
alterTable();
