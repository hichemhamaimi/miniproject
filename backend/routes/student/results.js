const express = require('express');
const router = express.Router();
const resultsController = require('../../controllers/student/resultsController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

router.use(verifyJWT);
router.use(verifyRoles('student'));
router.get('/', resultsController.getStudentResults);
router.get('/:id/document', resultsController.downloadCorrectionDocument);
router.get('/:id/document/view', resultsController.viewCorrectionDocument);
router.get('/:id', resultsController.getStudentResultDetails);

module.exports = router;
