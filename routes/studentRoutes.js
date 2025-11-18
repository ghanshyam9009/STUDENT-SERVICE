import express from "express";
import { registerStudent, loginStudent, updateProfile, upload, getPremiumPrices } from "../controllers/studentController.js";
import { verifyToken } from "../utils/auth.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.put("/profile/:email", updateProfile);
router.put("/profile/:email/upload", upload.single("document"), updateProfile);
router.get("/premium-prices", getPremiumPrices);

export default router;
