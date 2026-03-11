require('dotenv').config();
const pool = require('../config/dbConnect');
async function getMock() {
    try {
         const [users] = await pool.query("SELECT id FROM users LIMIT 1");
         const [modules] = await pool.query("SELECT id FROM modules LIMIT 1");
         console.log("Users:", users);
         console.log("Modules:", modules);
    } catch(err) { console.error(err); }
    process.exit();
}
getMock();
