require('dotenv').config();
const pool = require('../config/dbConnect');

async function describeTable() {
    try {
        const [rows] = await pool.query('DESCRIBE exams');
        console.log(rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
describeTable();
