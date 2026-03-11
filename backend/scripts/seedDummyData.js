require('dotenv').config();
const pool = require('../config/dbConnect');

async function seed() {
    try {
        await pool.query('SET FOREIGN_KEY_CHECKS=0');
        await pool.query('INSERT IGNORE INTO users (id, username, password_hash, role) VALUES (1, "teacher1", "dsadas", "teacher")').catch(e => console.log('user insert failed:', e.message));
        await pool.query('INSERT IGNORE INTO modules (id) VALUES (101)').catch(e => console.log('module insert failed:', e.message));
        await pool.query('SET FOREIGN_KEY_CHECKS=1');
        console.log('Dummy data seeded.');
    } catch(err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
seed();
