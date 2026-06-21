import { Router } from 'express';
import * as tagController from '../controllers/tag.controller';

// mergeParams: true → inherit :taskId from the parent task router mount point.
const router = Router({ mergeParams: true });

router.post('/', tagController.attachTagHandler);
router.delete('/:tagId', tagController.detachTagHandler);

export default router;
