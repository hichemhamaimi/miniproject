require('dotenv').config();
const pool = require('../config/dbConnect');
const bcrypt = require('bcrypt');

async function updatePassword() {
    try {
        const hash = await bcrypt.hash('123', 10);
        const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE username = "superadmin"', [hash]);
        console.log(`Updated ${result.affectedRows} row(s) for superadmin.`);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
updatePassword();
