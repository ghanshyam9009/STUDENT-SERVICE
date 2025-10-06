import express from "express";
import {
  registerEmployer,
  loginEmployer,
  updateEmployerProfile,
  upload
} from "../controllers/RecruiterController.js";

import multer from "multer";
import path from "path";


// export const upload = multer({ storage });

const router = express.Router();

// const storage = multer.memoryStorage();
// export const upload = multer({ storage });


router.post("/register", registerEmployer);
router.post("/login", loginEmployer);
router.put("/update/:email", updateEmployerProfile);

router.put("/update/:email/kyc", upload.single("document"), updateEmployerProfile);

export default router;
