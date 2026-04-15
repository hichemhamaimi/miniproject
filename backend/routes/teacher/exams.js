const express = require('express');
const router = express.Router();
const examController = require('../../controllers/teacher/examController');
const verifyJWT = require('../../middleware/verifyJWT');

// Define routes for exams
router.use(verifyJWT);
router.get('/', examController.getTeacherExams);
router.post('/', examController.createExam);
router.post('/:id/publish', examController.publishExam);
router.post('/:id/unpublish', examController.unpublishExam);
router.get('/:id', examController.getExamDetails);
router.put('/:id/groups', examController.updateExamGroups);
router.get('/:id/seb-config', examController.generateSebConfig);

module.exports = router;
