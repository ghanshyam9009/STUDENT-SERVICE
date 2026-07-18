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

// form-data: page (text), image (single/repeated files) or images (repeated files)
router.post(
  "/upload",
  bannerUpload.fields([
    { name: "image", maxCount: 10 },
    { name: "images", maxCount: 10 },
  ]),
  uploadBanner
);
router.get("/", getBanners);
router.get("/:banner_id", getBannerById);
router.put("/:banner_id", bannerUpload.single("image"), updateBanner);
router.delete("/:banner_id", deleteBanner);

export default router;
