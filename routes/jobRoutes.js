import express from "express";
import { closeRecruiterJob,postJob ,postGovernmentJob,updateGovernmentJob,updateJob,postJobByAdmin,updateAdminJob, closeGovernmentJob, closeAdminJob} from "../controllers/jobController.js";
// import { verifyEmployerAuth } from "../middleware/auth.js"; // optional JWT middleware

const router = express.Router();

// POST /api/jobs
router.post("/jobs", postJob);
router.post("/jobsadmin", postJobByAdmin);
router.post("/Govtjobs", postGovernmentJob);

router.post("/Updatejobs/:job_id", updateJob);
router.post("/updateadminjobs/:job_id", updateAdminJob);
router.post("/updateGovtjobs/:job_id", updateGovernmentJob);

router.post("/closedadminjobs/:job_id", closeAdminJob);
router.post("/closedGovtjobs/:job_id", closeGovernmentJob);
router.post("/closedRecruiterjobs/:job_id", closeRecruiterJob);


export default router;
