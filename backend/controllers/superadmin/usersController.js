const pool = require("../../config/dbConnect");
const bcrypt = require("bcrypt");

const getAllUsers = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name, lastname, date_of_birth, username, role, creation_date FROM users ORDER BY creation_date DESC"
        );
        res.json(rows);
    } catch (err) { 
        next(err); 
    }
};

const createUser = async (req, res, next) => {
    try {
        const { name, lastname, date_of_birth, username, password, role } = req.body;
        
        if (!name || !lastname || !date_of_birth || !username || !password || !role) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const validRoles = ['superadmin', 'department_admin', 'teacher', 'student'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: "Invalid role specified" });
        }

        const hashedPwd = await bcrypt.hash(password, 10);
        
        const [result] = await pool.query(
            "INSERT INTO users (name, lastname, date_of_birth, username, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
            [name, lastname, date_of_birth, username, hashedPwd, role]
        );
        res.status(201).json({ id: result.insertId, name, lastname, username, role });
    } catch (err) { 
        // Handle MySQL Duplicate Entry
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Username already exists." });
        }
        next(err); 
    }
};

const updatePassword = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ message: "New password is required" });
        }

        const hashedPwd = await bcrypt.hash(newPassword, 10);
        
        const [result] = await pool.query(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            [hashedPwd, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "Password updated successfully" });
    } catch (err) { 
        next(err); 
    }
};

const deleteUser = async (req, res, next) => {
    try {
        const id = req.params.id;
        await pool.query("DELETE FROM users WHERE id=?", [id]);
        res.json({ message: "User deleted successfully" });
    } catch (err) { 
        next(err); 
    }
};

module.exports = { getAllUsers, createUser, updatePassword, deleteUser };
