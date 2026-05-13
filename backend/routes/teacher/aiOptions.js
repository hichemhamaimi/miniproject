const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const controller = require('../../controllers/teacher/aiOptionsController');

router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));

router.get('/', controller.listAiOptions);

module.exports = router;
