// routes/premiumRoutes.js
import express from 'express';
import { markJobPremium } from '../controllers/jobController.js';
import { markStudentPremium } from '../controllers/studentController.js';

const router = express.Router();

router.post('/mark-job-premium', markJobPremium);
router.post('/mark-student-premium', markStudentPremium);

export default router;
