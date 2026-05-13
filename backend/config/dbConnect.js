const mysql2 = require('mysql2');

const pool = mysql2.createPool({
  host: process.env.DBHOST,
  port: Number.parseInt(process.env.DBPORT || '3306', 10),
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  database: process.env.DBNAME,
  waitForConnections: true,
  connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
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
