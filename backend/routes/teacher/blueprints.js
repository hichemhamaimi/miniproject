const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const { createBlueprint, getBlueprints, getBlueprint, updateBlueprint } = require('../../controllers/teacher/blueprintController');

router.use(verifyJWT);
router.use(verifyRoles('teacher', 'superadmin'));

router.post('/', createBlueprint);
router.get('/', getBlueprints);
router.get('/:id', getBlueprint);
router.put('/:id', updateBlueprint);

module.exports = router;
