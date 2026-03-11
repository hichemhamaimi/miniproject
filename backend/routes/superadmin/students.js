const express = require('express');
const router = express.Router();
const studentsController = require('../../controllers/superadmin/studentsController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

// Protect all routes
router.use(verifyJWT);
router.use(verifyRoles('superadmin'));

router.route('/')
    .get(studentsController.getAllStudents)
    .post(studentsController.createStudent);

router.route('/:id')
    .put(studentsController.updateStudent)
    .delete(studentsController.deleteStudent);

module.exports = router;
