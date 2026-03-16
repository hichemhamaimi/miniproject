const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const {
    generateExam,
    getJobStatus,
    getExams,
    getExam,
    updateExam,
    publishExam,
    unpublishExam
} = require('../../controllers/teacher/aiExamController');

router.use(verifyJWT);

router.post('/generate', generateExam);
router.get('/job/:jobId', getJobStatus);
router.get('/', getExams);
router.get('/:id', getExam);
router.put('/:id', updateExam);
router.post('/:id/publish', publishExam);
router.post('/:id/unpublish', unpublishExam);

module.exports = router;
