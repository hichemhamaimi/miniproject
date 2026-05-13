const express = require('express');
const router = express.Router();
const usersController = require('../../controllers/superadmin/usersController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');

router.use(verifyJWT);
router.use(verifyRoles('superadmin'));

router.get('/', usersController.getAllUsers);
router.post('/', usersController.createUser);
router.patch('/:id/password', usersController.updatePassword);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
