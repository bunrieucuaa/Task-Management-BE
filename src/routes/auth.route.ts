import { Router } from 'express';
import {
  changePasswordHandler,
  getMeHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@/generated/prisma/enums';

const router = Router();

// Public routes
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);

// Protected routes
router.post('/change-password', authenticate, changePasswordHandler);
router.post('/logout', authenticate, logoutHandler);
router.get('/me', authenticate, authorize(UserRole.ADMIN, UserRole.MEMBER), getMeHandler);

export default router;
