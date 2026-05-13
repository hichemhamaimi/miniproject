const express = require('express');
const router = express.Router();
const examController = require('../../controllers/teacher/examController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

// Define routes for exams
router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));
router.get('/', examController.getTeacherExams);
router.post('/', examController.createExam);
router.get('/:id/export-results', examController.exportResultsCsv);
router.get('/:id/results', examController.getExamResults);
router.get('/:id/results/:resultId/correction', examController.viewResultCorrectionDocument);
router.post('/:id/publish', examController.publishExam);
router.post('/:id/unpublish', examController.unpublishExam);
router.get('/:id', examController.getExamDetails);
router.put('/:id/groups', examController.updateExamGroups);

module.exports = router;
