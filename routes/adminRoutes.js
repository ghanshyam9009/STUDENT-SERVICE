import express from "express";
import {
  registerAdmin,
  loginAdmin,
  updateAdminProfile
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.put("/update/:email", updateAdminProfile);

export default router;
