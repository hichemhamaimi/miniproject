const express = require('express');
const router = express.Router();
const examTakingController = require('../../controllers/student/examTakingController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const verifySEB = require('../../middleware/verifySEB');

router.use(verifyJWT);
router.use(verifyRoles('student'));

// Get available exams for the logged in student
router.get('/', examTakingController.getAvailableExams);

// Download SEB File
router.get('/:id/seb', examTakingController.downloadSebFile);

// Enter exam room (Applies SEB validation)
router.post('/:id/start', verifySEB, examTakingController.enterExam);

// Submit exam answers (SEB validation is re-applied for protected exams)
router.post('/:id/submit', verifySEB, examTakingController.submitExam);

module.exports = router;
