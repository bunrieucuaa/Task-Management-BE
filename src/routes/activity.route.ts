import { Router } from 'express';
import * as activityController from '../controllers/activity.controller';

// mergeParams: true → inherit :taskId from the parent task router mount point.
const router = Router({ mergeParams: true });

router.get('/', activityController.listActivitiesHandler);

export default router;
