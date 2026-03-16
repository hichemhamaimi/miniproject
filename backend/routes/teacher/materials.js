const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const { uploadMaterial, getMaterials, getMaterial, deleteMaterial } = require('../../controllers/teacher/materialController');
const { createMindmap, getMindmap } = require('../../controllers/teacher/mindmapController');

router.use(verifyJWT);

router.post('/upload', uploadMaterial);
router.get('/', getMaterials);
router.get('/:id', getMaterial);
router.delete('/:id', deleteMaterial);
router.post('/:id/mindmap', createMindmap);
router.get('/:id/mindmap', getMindmap);

module.exports = router;
