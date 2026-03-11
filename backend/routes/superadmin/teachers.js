const express = require('express');
const router = express.Router();
const teachersController = require('../../controllers/superadmin/teachersController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

// Protect all routes
router.use(verifyJWT);
router.use(verifyRoles('superadmin'));

router.route('/')
    .get(teachersController.getAllTeachers)
    .post(teachersController.createTeacher);

router.route('/:id')
    .put(teachersController.updateTeacher)
    .delete(teachersController.deleteTeacher);

module.exports = router;
