import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as taskController from '../controllers/task.controller';

const router = Router();

// All task routes require authentication; project-scoped ownership checks
// happen in the service layer.
router.use(authenticate);

router.post('/', taskController.createTaskHandler);
router.get('/', taskController.listTasksHandler);
router.get('/:id', taskController.getTaskHandler);
router.patch('/:id', taskController.updateTaskHandler);
router.delete('/:id', taskController.deleteTaskHandler);

export default router;
