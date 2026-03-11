const express = require('express');
const router = express.Router();
const groupsController = require('../../controllers/departmentadmin/groupsController');
const verifyJWT = require('../../middleware/verifyJWT');
const verifyRoles = require('../../middleware/verifyRoles');
const requireDepartmentAdmin = require('../../middleware/requireDepartmentAdmin');

router.use(verifyJWT);
router.use(verifyRoles('department_admin'));
router.use(requireDepartmentAdmin);

router.route('/')
    .get(groupsController.getAllGroups)
    .post(groupsController.createGroup);

router.route('/:id')
    .put(groupsController.updateGroup)
    .delete(groupsController.deleteGroup);

router.get('/all-students', groupsController.getAllStudents);
router.post('/:id/students/:studentId', groupsController.assignStudent);

router.get('/:id/modules', groupsController.getGroupModules);
router.delete('/:groupId/modules/:moduleId', groupsController.removeModuleFromGroup);

module.exports = router;
