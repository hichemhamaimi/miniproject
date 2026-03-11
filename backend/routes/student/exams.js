const express = require('express');
const router = express.Router();
const examTakingController = require('../../controllers/student/examTakingController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifySEB = require('../../middleware/verifySEB');

router.use(verifyJWT);

// Get available exams for the logged in student
router.get('/', examTakingController.getAvailableExams);

// Enter exam room (Applies SEB validation)
router.post('/:id/start', verifySEB, examTakingController.enterExam);

// Submit exam answers
router.post('/:id/submit', examTakingController.submitExam);

module.exports = router;
