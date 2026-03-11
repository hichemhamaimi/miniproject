require('dotenv').config();
const pool = require('../config/dbConnect');

async function checkSchema() {
    try {
        const [usersDesc] = await pool.query('DESCRIBE users');
        console.log("USERS table:");
        console.log(usersDesc);

        const [deptDesc] = await pool.query('DESCRIBE departments').catch(() => [[], null]);
        if (deptDesc && deptDesc.length > 0) {
            console.log("\nDEPARTMENTS table:");
            console.log(deptDesc);
        } else {
            console.log("\nDEPARTMENTS table does not exist or access failed.");
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
checkSchema();
