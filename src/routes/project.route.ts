import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@/generated/prisma/enums';
import * as projectController from '../controllers/project.controller';

const router = Router();

// All project routes require authentication.
router.use(authenticate);

// Reading is open to any authenticated user (members see their own projects;
// service-layer access checks still apply).
router.get('/', projectController.listProjectsHandler);
router.get('/:id', projectController.getProjectHandler);
router.get('/:id/members', projectController.listMembersHandler);

// Creating and managing projects/members is limited to ADMIN and PM.
const manage = authorize(UserRole.ADMIN, UserRole.PM);

router.post('/', manage, projectController.createProjectHandler);
router.patch('/:id', manage, projectController.updateProjectHandler);
router.delete('/:id', manage, projectController.deleteProjectHandler);
router.post('/:id/members', manage, projectController.addMemberHandler);
router.delete('/:id/members/:userId', manage, projectController.removeMemberHandler);

export default router;
