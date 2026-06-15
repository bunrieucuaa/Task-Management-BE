import { Router } from 'express';
import * as commentController from '../controllers/comment.controller';

// mergeParams: true → inherit :taskId from the parent task router mount point.
const router = Router({ mergeParams: true });

router.get('/', commentController.listCommentsHandler);
router.post('/', commentController.createCommentHandler);
router.delete('/:commentId', commentController.deleteCommentHandler);

export default router;
