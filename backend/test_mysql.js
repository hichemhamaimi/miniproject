const pool = require('./config/dbConnect');

async function testQuery() {
    const id = 1; // dummy exam
    const validGroupIds = [1, 2];
    
    const groupValues = validGroupIds.map(gId => [id, gId]);
    console.log("Values to insert:", groupValues);
    
    // Test the generated SQL
    const connection = await pool.getConnection();
    try {
        console.log("SQL:");
        const query = connection.format(`INSERT INTO exam_groups (exam_id, group_id) VALUES ?`, [groupValues]);
        console.log(query);
    } catch(e) {
        console.error(e);
    } finally {
        connection.release();
        process.exit(0);
    }
}

testQuery();
