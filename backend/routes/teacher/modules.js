const express = require('express');
const router = express.Router();
const moduleController = require('../../controllers/teacher/moduleController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));

router.get('/', moduleController.getTeacherModules);
router.get('/:moduleId/workflow', moduleController.getModuleWorkflowData);
router.get('/:moduleId/students', moduleController.getModuleStudents);
router.get('/:moduleId/exams', moduleController.getModuleExams);

module.exports = router;
