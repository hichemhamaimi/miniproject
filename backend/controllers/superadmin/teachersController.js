const pool = require("../../config/dbConnect");
const bcrypt = require("bcrypt");

const getAllTeachers = async (req, res, next) => {
    try {
        const [rows] = await pool.query("SELECT id, name, lastname, date_of_birth, username, role, creation_date FROM users WHERE role = 'teacher'");
        res.json(rows);
    } catch (err) { 
        next(err); 
    }
};

const createTeacher = async (req, res, next) => {
    try {
        const { name, lastname, date_of_birth, username, password } = req.body;
        if (!name || !lastname || !date_of_birth || !username || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const hashedPwd = await bcrypt.hash(password, 10);
        
        const [result] = await pool.query(
            "INSERT INTO users (name, lastname, date_of_birth, username, password_hash, role) VALUES (?, ?, ?, ?, ?, 'teacher')",
            [name, lastname, date_of_birth, username, hashedPwd]
        );
        res.status(201).json({ id: result.insertId, name, lastname, username, role: "teacher" });
    } catch (err) { 
        next(err); 
    }
};

const updateTeacher = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { name, lastname, date_of_birth, username, password } = req.body;
        
        if (password) {
            const hashedPwd = await bcrypt.hash(password, 10);
            await pool.query(
                "UPDATE users SET name=?, lastname=?, date_of_birth=?, username=?, password_hash=? WHERE id=? AND role='teacher'",
                [name, lastname, date_of_birth, username, hashedPwd, id]
            );
        } else {
            await pool.query(
                "UPDATE users SET name=?, lastname=?, date_of_birth=?, username=? WHERE id=? AND role='teacher'",
                [name, lastname, date_of_birth, username, id]
            );
        }
        
        res.json({ message: "Teacher updated successfully" });
    } catch (err) { 
        next(err); 
    }
};

const deleteTeacher = async (req, res, next) => {
    try {
        const id = req.params.id;
        await pool.query("DELETE FROM users WHERE id=? AND role='teacher'", [id]);
        res.json({ message: "Teacher deleted successfully" });
    } catch (err) { 
        next(err); 
    }
};

module.exports = { getAllTeachers, createTeacher, updateTeacher, deleteTeacher };
