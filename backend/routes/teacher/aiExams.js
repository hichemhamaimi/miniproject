const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const {
    generateExam,
    getJobStatus,
    getExams,
    getArchivedExams,
    getExam,
    updateExam,
    publishExam,
    unpublishExam
} = require('../../controllers/teacher/aiExamController');

router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));

router.post('/generate', generateExam);
router.get('/job/:jobId', getJobStatus);
router.get('/', getExams);
router.get('/archive/history', getArchivedExams);
router.get('/:id', getExam);
router.put('/:id', updateExam);
router.post('/:id/publish', publishExam);
router.post('/:id/unpublish', unpublishExam);

module.exports = router;
