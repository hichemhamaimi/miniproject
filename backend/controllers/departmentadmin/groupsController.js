const pool = require("../../config/dbConnect");

const getAllGroups = async (req, res, next) => {
    try {
        const [rows] = await pool.query("SELECT * FROM student_groups WHERE department_id = ?", [req.departmentId]);
        res.json(rows);
    } catch (err) { next(err); }
};

const createGroup = async (req, res, next) => {
    try {
        const { name, abbreviation, year } = req.body;
        if (!name || !abbreviation || !year) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const [result] = await pool.query(
            "INSERT INTO student_groups (name, abbreviation, year, department_id) VALUES (?, ?, ?, ?)",
            [name, abbreviation, year, req.departmentId]
        );
        res.status(201).json({ id: result.insertId, name, abbreviation, year, department_id: req.departmentId });
    } catch (err) { next(err); }
};

const updateGroup = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { name, abbreviation, year } = req.body;
        
        await pool.query(
            "UPDATE student_groups SET name=?, abbreviation=?, year=? WHERE id=? AND department_id=?",
            [name, abbreviation, year, id, req.departmentId]
        );
        res.json({ message: "Group updated successfully" });
    } catch (err) { next(err); }
};

const deleteGroup = async (req, res, next) => {
    try {
        const id = req.params.id;
        await pool.query("DELETE FROM student_groups WHERE id=? AND department_id=?", [id, req.departmentId]);
        res.json({ message: "Group deleted successfully" });
    } catch (err) { next(err); }
};

const assignStudent = async (req, res, next) => {
    try {
        const { id: groupId, studentId } = req.params;
        
        // Verify group belongs to this department
        const [groups] = await pool.query("SELECT id FROM student_groups WHERE id=? AND department_id=?", [groupId, req.departmentId]);
        if (groups.length === 0) return res.status(404).json({ message: "Group not found in your department" });
        
        // Ensure student exists in users table
        const [users] = await pool.query("SELECT id FROM users WHERE id=? AND role='student'", [studentId]);
        if(users.length === 0) return res.status(404).json({ message: "Student not found" });

        // Insert or update student attribution
        await pool.query(
            "INSERT INTO students (id, group_id, attribution_date) VALUES (?, ?, CURDATE()) ON DUPLICATE KEY UPDATE group_id = VALUES(group_id), attribution_date = VALUES(attribution_date)",
            [studentId, groupId]
        );
        res.json({ message: "Student assigned to group successfully" });
    } catch (err) { next(err); }
};

const getAllStudents = async (req, res, next) => {
    try {
        const [students] = await pool.query(
            "SELECT id, name, lastname, username FROM users WHERE role='student' ORDER BY lastname ASC"
        );
        res.json(students);
    } catch (err) { next(err); }
};

const getGroupModules = async (req, res, next) => {
    try {
        const groupId = req.params.id;
        
        // Verify group belongs to this department
        const [groups] = await pool.query("SELECT id FROM student_groups WHERE id=? AND department_id=?", [groupId, req.departmentId]);
        if (groups.length === 0) return res.status(404).json({ message: "Group not found in your department" });

        const [modules] = await pool.query(
            `SELECT m.id, m.name, m.abbreviation, m.responsable_teacher_id 
             FROM modules m 
             INNER JOIN group_modules gm ON m.id = gm.module_id 
             WHERE gm.group_id = ?`,
            [groupId]
        );
        res.json(modules);
    } catch (err) { next(err); }
};

const removeModuleFromGroup = async (req, res, next) => {
    try {
        const { groupId, moduleId } = req.params;

        // Verify group belongs to this department
        const [groups] = await pool.query("SELECT id FROM student_groups WHERE id=? AND department_id=?", [groupId, req.departmentId]);
        if (groups.length === 0) return res.status(404).json({ message: "Group not found in your department" });

        await pool.query("DELETE FROM group_modules WHERE group_id=? AND module_id=?", [groupId, moduleId]);
        res.json({ message: "Module removed from group successfully" });
    } catch (err) { next(err); }
};

module.exports = { getAllGroups, createGroup, updateGroup, deleteGroup, assignStudent, getGroupModules, removeModuleFromGroup, getAllStudents };
