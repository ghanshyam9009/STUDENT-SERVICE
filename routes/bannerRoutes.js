import express from "express";
import {
  bannerUpload,
  uploadBanner,
  getBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
} from "../controllers/bannerController.js";

const router = express.Router();

// form-data fields: page (text), image (file)
router.post("/upload", bannerUpload.single("image"), uploadBanner);
router.get("/", getBanners);
router.get("/:banner_id", getBannerById);
router.put("/:banner_id", bannerUpload.single("image"), updateBanner);
router.delete("/:banner_id", deleteBanner);

export default router;
