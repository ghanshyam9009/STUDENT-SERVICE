import express from "express";
import {
  sendOtp,
  verifyOtp,
  resetPassword,
  resendOtp,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  resendRegistrationOtp,
} from "../controllers/passwordController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/resend-otp", resendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

router.post("/send-otp-registration", sendRegistrationOtp);
router.post("/resend-otp-registration", resendRegistrationOtp);
router.post("/verify-otp-registration", verifyRegistrationOtp);

export default router;
