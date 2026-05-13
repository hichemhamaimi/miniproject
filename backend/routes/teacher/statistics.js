const express = require('express');
const router = express.Router();
const statisticsController = require('../../controllers/teacher/statisticsController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));
router.get('/:id', statisticsController.getExamStatistics);

module.exports = router;
