import { Router } from 'express';
import { loginHandler } from '../controllers/auth.controller';
// import { authenticate } from '../middlewares/auth.middleware';

const authRouter = Router();

// Public routes
authRouter.post('/login', loginHandler);


export default authRouter;