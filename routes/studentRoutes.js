import express from "express";
import { updateLogo, registerStudent, loginStudent, updateProfile, upload, getPremiumPrices } from "../controllers/studentController.js";
import { verifyToken } from "../utils/auth.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.put("/profile/:email", updateProfile);

router.put("/profile/:email/upload", upload.single("document"), updateProfile);

// Resume upload
// router.put(
//     "/profile/:email/resume",
//     verifyToken,
//     upload.single("document"),
//     updateProfile
//   );
  
  // Logo / Profile Pic upload
  router.put(
    "/profile/:email/logo",
    // verifyToken,
    upload.single("logo"),
    updateLogo
  );
  
router.get("/premium-prices", getPremiumPrices);

export default router;
