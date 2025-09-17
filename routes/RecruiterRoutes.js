import express from "express";
import {
  registerEmployer,
  loginEmployer,
  updateEmployerProfile
} from "../controllers/RecruiterController.js";

const router = express.Router();

router.post("/register", registerEmployer);
router.post("/login", loginEmployer);
router.put("/update/:employer_id", updateEmployerProfile);

export default router;
