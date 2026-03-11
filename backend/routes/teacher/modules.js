const express = require('express');
const router = express.Router();
const moduleController = require('../../controllers/teacher/moduleController');
const verifyJWT = require('../../middleware/verifyJWT'); // Assuming this exists based on standard practices in the project
const verifyRoles = require('../../middleware/verifyRoles'); // Assuming this exists

// You might uncomment the middleware if auth is fully integrated in these routes:
router.use(verifyJWT);
// router.use(verifyRoles('teacher', 'superadmin'));

router.get('/', moduleController.getTeacherModules);
router.get('/:moduleId/students', moduleController.getModuleStudents);
router.get('/:moduleId/exams', moduleController.getModuleExams);

module.exports = router;
