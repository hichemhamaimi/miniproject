const pool = require("../config/dbConnect");
const AppError = require("../utils/AppError");

const requireDepartmentAdmin = async (req, res, next) => {
    try {
        if (req.role !== 'department_admin') {
            return next(new AppError(403, "Resource reserved for Department Admins only"));
        }
        
        // Find department where this user is the admin
        const [rows] = await pool.query("SELECT id FROM departments WHERE department_admin_id = ?", [req.userId]);
        
        if (rows.length === 0) {
            return next(new AppError(403, "You are not assigned as an admin to any department."));
        }
        
        req.departmentId = rows[0].id;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireDepartmentAdmin;
