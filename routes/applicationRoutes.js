import express from "express";
import { applyForJob } from "../controllers/applicationController.js";
// import { verifyStudentAuth } from "../middleware/auth.js"; // JWT auth for students

const router = express.Router();

// POST /api/jobs/:job_id/apply
router.post("/jobs/:job_id/apply", applyForJob);

export default router;
