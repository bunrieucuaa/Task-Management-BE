import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import * as tagController from '../controllers/tag.controller';

const router = Router();

// Tag catalogue routes require authentication; role checks happen in the service.
router.use(authenticate);

router.get('/', tagController.listTagsHandler);
router.post('/', tagController.createTagHandler);
router.delete('/:id', tagController.deleteTagHandler);

export default router;
