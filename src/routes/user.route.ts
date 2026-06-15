import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize }    from '../middlewares/auth.middleware';
import { UserRole }     from '@/generated/prisma/enums';
import * as userController from '../controllers/user.controller';

const router = Router();

// Tất cả user routes đều yêu cầu authenticate
router.use(authenticate);

// ADMIN + PM: lightweight user directory for member/assignee pickers.
// Declared before '/:id' so "directory" is not captured as an id.
router.get(    '/directory',         authorize(UserRole.ADMIN, UserRole.PM), userController.listDirectoryHandler);

// ADMIN only
router.post(   '/',                  authorize(UserRole.ADMIN), userController.createUserHandler);
router.get(    '/',                  authorize(UserRole.ADMIN), userController.listUsersHandler);
router.patch(  '/:id/status',        authorize(UserRole.ADMIN), userController.updateUserStatusHandler);
router.post(   '/:id/reset-password',authorize(UserRole.ADMIN), userController.resetUserPasswordHandler);
router.delete( '/:id',               authorize(UserRole.ADMIN), userController.deleteUserHandler);

// ADMIN + chính user đó (check thêm trong controller)
router.get(    '/:id',               userController.getUserHandler);
router.patch(  '/:id',               userController.updateUserHandler);

export default router;
