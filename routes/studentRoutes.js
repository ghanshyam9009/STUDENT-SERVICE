import express from "express";
import { registerStudent, loginStudent, updateProfile } from "../controllers/studentController.js";
import { verifyToken } from "../utils/auth.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.put("/profile/:email", verifyToken, updateProfile);

export default router;
