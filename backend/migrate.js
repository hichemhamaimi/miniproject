require("dotenv").config();
const mysql2 = require('mysql2');

const pool = mysql2.createPool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  database: process.env.DBNAME,
}).promise();

async function migrate() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        question_text TEXT NOT NULL,
        option_a VARCHAR(500) NOT NULL,
        option_b VARCHAR(500) NOT NULL,
        option_c VARCHAR(500) NOT NULL,
        option_d VARCHAR(500) NOT NULL,
        correct_option ENUM('A','B','C','D') NOT NULL,
        points INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      );
    `;
    await pool.query(sql);
    console.log("Table 'questions' created successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    pool.end();
  }
}

migrate();
