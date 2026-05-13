const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const controller = require('../../controllers/teacher/llmProviderController');

router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));
router.get('/', controller.listProviders);
router.post('/', controller.createProvider);
router.put('/:id/default', controller.setDefaultProvider);
router.put('/assign/exams/:examId', controller.assignExamProvider);

module.exports = router;
