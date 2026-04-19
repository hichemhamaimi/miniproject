const mysql2 = require('mysql2');
require('dotenv').config();

const pool = mysql2.createPool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  database: process.env.DBNAME,
}).promise();

async function migrate() {
  try {
    console.log("Starting results tables migration...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS exam_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        exam_id INT NOT NULL,
        score DECIMAL(5,2) NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);
    console.log("Created exam_results table.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS question_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_result_id INT NOT NULL,
        question_id VARCHAR(255) NOT NULL,
        selected_choice JSON,
        is_correct BOOLEAN NOT NULL,
        FOREIGN KEY (exam_result_id) REFERENCES exam_results(id) ON DELETE CASCADE
      )
    `);
    console.log("Created question_results table.");

    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
