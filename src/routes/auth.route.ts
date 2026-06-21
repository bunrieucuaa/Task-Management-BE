import { Router } from 'express';
import {
  changePasswordHandler,
  getMeHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);

// Protected routes
router.post('/change-password', authenticate, changePasswordHandler);
router.post('/logout', authenticate, logoutHandler);
// `/me` trả về chính user đang đăng nhập — KHÔNG gate theo role (PM/ADMIN/MEMBER đều dùng).
router.get('/me', authenticate, getMeHandler);

export default router;
