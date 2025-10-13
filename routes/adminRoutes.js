import express from "express";
import {
  registerAdmin,
  loginAdmin,
  updateAdminProfile,
  updatePremiumPrices,
  approveRecruiter,
  getAllRecruiters,
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.put("/update/:email", updateAdminProfile);
router.put("/update/premium-price",updatePremiumPrices );
router.put("/approved-recruiter", approveRecruiter);
router.get("/get-all-recruiter",getAllRecruiters)

export default router;
