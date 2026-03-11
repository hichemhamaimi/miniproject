const pool = require("../../config/dbConnect");

const getAllModules = async (req, res, next) => {
    try {
        const query = `
            SELECT m.id, m.name, m.abbreviation, m.responsable_teacher_id, 
                   u.name AS teacher_first_name, u.lastname AS teacher_last_name 
            FROM modules m 
            LEFT JOIN users u ON m.responsable_teacher_id = u.id
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) { next(err); }
};

const createModule = async (req, res, next) => {
    try {
        const { name, abbreviation, responsable_teacher_id } = req.body;
        if (!name || !abbreviation || !responsable_teacher_id) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        const [result] = await pool.query(
            "INSERT INTO modules (name, abbreviation, responsable_teacher_id) VALUES (?, ?, ?)",
            [name, abbreviation, responsable_teacher_id]
        );
        res.status(201).json({ id: result.insertId, name, abbreviation, responsable_teacher_id });
    } catch (err) { next(err); }
};

const updateModule = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { name, abbreviation, responsable_teacher_id } = req.body;
        await pool.query(
            "UPDATE modules SET name=?, abbreviation=?, responsable_teacher_id=? WHERE id=?",
            [name, abbreviation, responsable_teacher_id, id]
        );
        res.json({ message: "Module updated successfully" });
    } catch (err) { next(err); }
};

const deleteModule = async (req, res, next) => {
    try {
        const id = req.params.id;
        await pool.query("DELETE FROM modules WHERE id=?", [id]);
        res.json({ message: "Module deleted successfully" });
    } catch (err) { next(err); }
};

const assignModuleToGroup = async (req, res, next) => {
    try {
        const { id: moduleId, groupId } = req.params;
        
        // Ensure group belongs to admin's department
        const [groups] = await pool.query("SELECT id FROM student_groups WHERE id=? AND department_id=?", [groupId, req.departmentId]);
        if (groups.length === 0) return res.status(404).json({ message: "Group not found in your department" });

        // Ensure module exists
        const [modules] = await pool.query("SELECT id FROM modules WHERE id=?", [moduleId]);
        if (modules.length === 0) return res.status(404).json({ message: "Module not found" });

        // Insert assignment
        await pool.query("INSERT IGNORE INTO group_modules (group_id, module_id) VALUES (?, ?)", [groupId, moduleId]);
        res.json({ message: "Module assigned to group successfully" });
    } catch (err) { next(err); }
};

module.exports = { getAllModules, createModule, updateModule, deleteModule, assignModuleToGroup };
