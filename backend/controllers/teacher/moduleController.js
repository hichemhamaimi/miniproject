const pool = require('../../config/dbConnect');

// 1. Get all modules assigned to the logged-in teacher
const getTeacherModules = async (req, res) => {
    try {
        const teacher_id = req.userId;

        // Join to get department abbreviation for context
        const query = `
            SELECT m.id, m.name, m.abbreviation,
                   gm.group_id, sg.name as group_name, sg.year, d.abbreviation as department_abbreviation
            FROM modules m
            LEFT JOIN group_modules gm ON m.id = gm.module_id
            LEFT JOIN student_groups sg ON gm.group_id = sg.id
            LEFT JOIN departments d ON sg.department_id = d.id
            WHERE m.responsable_teacher_id = ?
            ORDER BY m.name ASC
        `;

        const [rows] = await pool.query(query, [teacher_id]);
        
        // Group results by module to handle multiple groups per module elegantly
        const modulesMap = {};
        
        rows.forEach(row => {
            if (!modulesMap[row.id]) {
                modulesMap[row.id] = {
                    id: row.id,
                    name: row.name,
                    abbreviation: row.abbreviation,
                    groups: []
                };
            }
            if (row.group_id) {
                modulesMap[row.id].groups.push({
                    id: row.group_id,
                    name: row.group_name,
                    year: row.year,
                    department: row.department_abbreviation
                });
            }
        });

        const formattedModules = Object.values(modulesMap);

        res.status(200).json(formattedModules);
    } catch (error) {
        console.error("Error fetching teacher modules:", error);
        res.status(500).json({ message: "Server error fetching modules." });
    }
};

// 2. Get students assigned to a specific module
const getModuleStudents = async (req, res) => {
    try {
        const teacher_id = req.userId;
        const { moduleId } = req.params;

        // Security check: ensure this teacher actually teaches this module
        const [moduleCheck] = await pool.query('SELECT id FROM modules WHERE id = ? AND responsable_teacher_id = ?', [moduleId, teacher_id]);
        
        if (moduleCheck.length === 0) {
            return res.status(403).json({ message: "You are not authorized to view students for this module." });
        }

        // Query students taking this module
        // A module -> group_id -> students mapping
        const query = `
            SELECT u.id, u.name, u.lastname, u.username, sg.name as group_name, sg.year 
            FROM users u
            JOIN students s ON u.id = s.id
            JOIN student_groups sg ON s.group_id = sg.id
            JOIN group_modules gm ON sg.id = gm.group_id
            WHERE gm.module_id = ? AND u.role = 'student'
            ORDER BY u.lastname ASC, u.name ASC
        `;

        const [students] = await pool.query(query, [moduleId]);

        res.status(200).json(students);
    } catch (error) {
        console.error("Error fetching module students:", error);
        res.status(500).json({ message: "Server error fetching students." });
    }
};

// 3. Get exams history for a specific module
const getModuleExams = async (req, res) => {
    try {
        const teacher_id = req.userId;
        const { moduleId } = req.params;

        // Security check: ensure this teacher teaches this module
        const [moduleCheck] = await pool.query('SELECT id FROM modules WHERE id = ? AND responsable_teacher_id = ?', [moduleId, teacher_id]);
        
        if (moduleCheck.length === 0) {
            return res.status(403).json({ message: "You are not authorized to view exams for this module." });
        }

        const query = `
            SELECT e.id, e.title, e.creation_date, e.status, e.duration_minutes, e.start_time, e.end_time,
                   u.id as creator_id, u.name as creator_name, u.lastname as creator_lastname
            FROM exams e
            JOIN users u ON e.teacher_id = u.id
            WHERE e.module_id = ?
            ORDER BY e.creation_date DESC
        `;

        const [exams] = await pool.query(query, [moduleId]);

        res.status(200).json(exams);
    } catch (error) {
        console.error("Error fetching module exams:", error);
        res.status(500).json({ message: "Server error fetching exams." });
    }
};

module.exports = {
    getTeacherModules,
    getModuleStudents,
    getModuleExams
};
