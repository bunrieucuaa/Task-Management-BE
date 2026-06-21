import { Router } from "express";
import authRoutes from "./auth.route";
import userRoutes from './user.route';
import projectRoutes from './project.route';
import taskRoutes from './task.route';
import tagRoutes from './tag.route';

const router = Router();

router.use("/auth", authRoutes)
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/tags', tagRoutes);


export default router;

