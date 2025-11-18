import express from "express";
import { applyForJob , applications, applyForGovernmentJob, applyForAdminJob} from "../controllers/applicationController.js";
// import { verifyStudentAuth } from "../middleware/auth.js"; // JWT auth for students

const router = express.Router();

// POST /api/jobs/:job_id/apply
router.post("/jobs/:job_id/apply", applyForJob);
router.post("/Govtjobs/:job_id/apply", applyForGovernmentJob);
router.post("/Adminjobs/:job_id/apply", applyForAdminJob);
router.get("/jobs/applications/:job_id", applications);

export default router;
