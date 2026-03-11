const express = require('express');
const router = express.Router();
const modulesController = require('../../controllers/departmentadmin/modulesController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const requireDepartmentAdmin = require('../../middleware/requireDepartmentAdmin');

router.use(verifyJWT);
router.use(verifyRoles('department_admin'));
router.use(requireDepartmentAdmin);

router.route('/')
    .get(modulesController.getAllModules)
    .post(modulesController.createModule);

router.route('/:id')
    .put(modulesController.updateModule)
    .delete(modulesController.deleteModule);

router.post('/:id/groups/:groupId', modulesController.assignModuleToGroup);

module.exports = router;
