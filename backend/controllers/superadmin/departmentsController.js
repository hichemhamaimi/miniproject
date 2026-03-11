const pool = require("../../config/dbConnect");

const getAllDepartments = async (req, res, next) => {
    try {
        const [rows] = await pool.query("SELECT * FROM departments");
        res.json(rows);
    } catch (err) { 
        next(err); 
    }
};

const createDepartment = async (req, res, next) => {
    try {
        const { name, abbreviation, department_admin_id } = req.body;
        if (!name || !abbreviation || !department_admin_id) {
            return res.status(400).json({ message: "name, abbreviation, and department_admin_id are required." });
        }
        const [result] = await pool.query(
            "INSERT INTO departments (name, abbreviation, department_admin_id) VALUES (?, ?, ?)",
            [name, abbreviation, department_admin_id]
        );
        res.status(201).json({ id: result.insertId, name, abbreviation, department_admin_id });
    } catch (err) { 
        next(err); 
    }
};

const updateDepartment = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { name, abbreviation, department_admin_id } = req.body;
        await pool.query(
            "UPDATE departments SET name=?, abbreviation=?, department_admin_id=? WHERE id=?",
            [name, abbreviation, department_admin_id, id]
        );
        res.json({ message: "Department updated successfully" });
    } catch (err) { 
        next(err); 
    }
};

const deleteDepartment = async (req, res, next) => {
    try {
        const id = req.params.id;
        await pool.query("DELETE FROM departments WHERE id=?", [id]);
        res.json({ message: "Department deleted successfully" });
    } catch (err) { 
        next(err); 
    }
};

module.exports = { getAllDepartments, createDepartment, updateDepartment, deleteDepartment };
