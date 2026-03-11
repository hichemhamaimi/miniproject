const express = require('express');
const router = express.Router();
const teachersController = require('../../controllers/departmentadmin/teachersController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const requireDepartmentAdmin = require('../../middleware/requireDepartmentAdmin');

router.use(verifyJWT);
router.use(verifyRoles('department_admin'));
router.use(requireDepartmentAdmin);

router.route('/')
    .get(teachersController.getAllTeachers);

module.exports = router;
