const pool = require("../../config/dbConnect");
const bcrypt = require("bcrypt");

const getAllStudents = async (req, res, next) => {
    try {
        const query = `
            SELECT u.id, u.name, u.lastname, u.date_of_birth, u.username, u.role, u.creation_date, s.group_id, s.attribution_date 
            FROM users u
            LEFT JOIN students s ON u.id = s.id
            WHERE u.role = 'student'
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) { 
        next(err); 
    }
};

const createStudent = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { name, lastname, date_of_birth, username, password, group_id, attribution_date } = req.body;
        
        if (!name || !lastname || !date_of_birth || !username || !password || !group_id || !attribution_date) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const hashedPwd = await bcrypt.hash(password, 10);
        
        const [userResult] = await connection.query(
            "INSERT INTO users (name, lastname, date_of_birth, username, password_hash, role) VALUES (?, ?, ?, ?, ?, 'student')",
            [name, lastname, date_of_birth, username, hashedPwd]
        );
        
        const studentId = userResult.insertId;
        
        await connection.query(
            "INSERT INTO students (id, group_id, attribution_date) VALUES (?, ?, ?)",
            [studentId, group_id, attribution_date]
        );
        
        await connection.commit();
        res.status(201).json({ id: studentId, username, role: "student", group_id });
    } catch (err) { 
        await connection.rollback();
        next(err); 
    } finally {
        connection.release();
    }
};

const updateStudent = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const id = req.params.id;
        const { name, lastname, date_of_birth, username, password, group_id, attribution_date } = req.body;
        
        if (password) {
            const hashedPwd = await bcrypt.hash(password, 10);
            await connection.query(
                "UPDATE users SET name=?, lastname=?, date_of_birth=?, username=?, password_hash=? WHERE id=? AND role='student'",
                [name, lastname, date_of_birth, username, hashedPwd, id]
            );
        } else {
            await connection.query(
                "UPDATE users SET name=?, lastname=?, date_of_birth=?, username=? WHERE id=? AND role='student'",
                [name, lastname, date_of_birth, username, id]
            );
        }
        
        if (group_id && attribution_date) {
            await connection.query(
                "UPDATE students SET group_id=?, attribution_date=? WHERE id=?",
                [group_id, attribution_date, id]
            );
        }
        
        await connection.commit();
        res.json({ message: "Student updated successfully" });
    } catch (err) { 
        await connection.rollback();
        next(err); 
    } finally {
        connection.release();
    }
};

const deleteStudent = async (req, res, next) => {
    try {
        const id = req.params.id;
        // cascades to students table
        await pool.query("DELETE FROM users WHERE id=? AND role='student'", [id]);
        res.json({ message: "Student deleted successfully" });
    } catch (err) { 
        next(err); 
    }
};

module.exports = { getAllStudents, createStudent, updateStudent, deleteStudent };
