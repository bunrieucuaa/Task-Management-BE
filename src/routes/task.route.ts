import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as taskController from '../controllers/task.controller';
import commentRoutes from './comment.route';
import taskTagRoutes from './task-tag.route';

const router = Router();

// All task routes require authentication; project-scoped ownership checks
// happen in the service layer.
router.use(authenticate);

router.post('/', taskController.createTaskHandler);
router.get('/', taskController.listTasksHandler);
router.get('/:id', taskController.getTaskHandler);
router.patch('/:id', taskController.updateTaskHandler);
router.delete('/:id', taskController.deleteTaskHandler);

// Nested comment routes: /api/v1/tasks/:taskId/comments
router.use('/:taskId/comments', commentRoutes);

// Nested tag attach/detach routes: /api/v1/tasks/:taskId/tags
router.use('/:taskId/tags', taskTagRoutes);

export default router;
