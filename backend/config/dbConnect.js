const mysql2 = require('mysql2');

const pool = mysql2.createPool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  database: process.env.DBNAME,
}).promise();

async function checkDatabaseConnection() {
  try {
    const [rows] = await pool.execute('SELECT 1');
    console.log('Connected to MySQL database');
  } catch (err) {
    console.error('Failed to connect to the MySQL database:', err.message);
  }
}

checkDatabaseConnection();

module.exports = pool;
