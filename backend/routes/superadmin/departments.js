const express = require('express');
const router = express.Router();
const departmentsController = require('../../controllers/superadmin/departmentsController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

// Protect all routes
router.use(verifyJWT);
router.use(verifyRoles('superadmin'));

router.route('/')
    .get(departmentsController.getAllDepartments)
    .post(departmentsController.createDepartment);

router.route('/:id')
    .put(departmentsController.updateDepartment)
    .delete(departmentsController.deleteDepartment);

module.exports = router;
