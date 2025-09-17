import express from "express";
import { postJob } from "../controllers/jobController.js";
// import { verifyEmployerAuth } from "../middleware/auth.js"; // optional JWT middleware

const router = express.Router();

// POST /api/jobs
router.post("/jobs", postJob);

export default router;
