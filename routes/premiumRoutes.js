// routes/premiumRoutes.js
import express from 'express';
import { markJobPremium } from '../controllers/jobController.js';
import { markStudentPremium } from '../controllers/studentController.js';

const router = express.Router();


const app = express();
// ✅ These two lines are required to populate req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

router.post('/mark-job-premium', markJobPremium);
router.post('/mark-student-premium', markStudentPremium);

export default router;
