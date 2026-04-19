const express = require('express');
const router = express.Router();
const statisticsController = require('../../controllers/teacher/statisticsController');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(verifyJWT);
router.get('/:id', statisticsController.getExamStatistics);

module.exports = router;
