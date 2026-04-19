const express = require('express');
const router = express.Router();
const resultsController = require('../../controllers/student/resultsController');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(verifyJWT);
router.get('/', resultsController.getStudentResults);
router.get('/:id', resultsController.getStudentResultDetails);

module.exports = router;
