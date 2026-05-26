import express from "express";
import {
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
} from "../controllers/planController.js";

const router = express.Router();

router.post("/", createPlan);
router.get("/", getAllPlans);
router.get("/:plan_id", getPlanById);
router.put("/:plan_id", updatePlan);
router.delete("/:plan_id", deletePlan);

export default router;
