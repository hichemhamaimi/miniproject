const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const { uploadMaterial, getMaterials, getMaterial, deleteMaterial, retryMaterial } = require('../../controllers/teacher/materialController');
const { createMindmap, getMindmap } = require('../../controllers/teacher/mindmapController');

router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));

router.post('/upload', uploadMaterial);
router.get('/', getMaterials);
router.get('/:id', getMaterial);
router.delete('/:id', deleteMaterial);
router.post('/:id/retry', retryMaterial);
router.post('/:id/mindmap', createMindmap);
router.get('/:id/mindmap', getMindmap);

module.exports = router;
