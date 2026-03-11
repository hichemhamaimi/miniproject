const pool = require("../../config/dbConnect");

const getAllTeachers = async (req, res, next) => {
    try {
        const [rows] = await pool.query("SELECT id, name, lastname, username FROM users WHERE role = 'teacher'");
        res.json(rows);
    } catch (err) { next(err); }
};

module.exports = { getAllTeachers };
