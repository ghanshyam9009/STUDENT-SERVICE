import express from "express";
import {
  registerAdmin,
  loginAdmin,
  updateAdminProfile,
  updatePremiumPrices,
  approveRecruiter,
  getAllRecruiters,
  getAllcandidates,
  blockStudentByAdmin,
  blockEmployerByAdmin
} from "../controllers/adminController.js";

const router = express.Router();



const app = express();

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.put("/update/:email", updateAdminProfile);
router.put("/updates/premium-pricess",updatePremiumPrices );
router.put("/approved-recruiter", approveRecruiter);
router.get("/get-all-recruiter",getAllRecruiters)
router.get("/get-all-candidates",getAllcandidates)
router.get("/block-recruiter",blockEmployerByAdmin)
router.get("/block-student",blockStudentByAdmin)

export default router;
