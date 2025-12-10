import express from "express";
import { sendOtp, verifyOtp, resetPassword ,sendRegistrationOtp, verifyRegistrationOtp} from "../controllers/passwordController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);



router.post("/send-otp-registration", sendRegistrationOtp);
router.post("/verify-otp-registration", verifyRegistrationOtp);

export default router;
