const express = require('express');
const router = express.Router();
const usersController = require('../../controllers/superadmin/usersController');

router.get('/', usersController.getAllUsers);
router.post('/', usersController.createUser);
router.patch('/:id/password', usersController.updatePassword);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
