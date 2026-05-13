const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const controller = require('../../controllers/superadmin/aiProviderController');

router.use(verifyJWT);
router.use(verifyRoles('superadmin'));

router.get('/', controller.listAllProviders);
router.post('/', controller.createProvider);
router.put('/:id', controller.updateProvider);
router.put('/:id/default', controller.setDefaultProvider);
router.delete('/:id', controller.deleteProvider);

module.exports = router;
