import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  PutCommand,
  ScanCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";

dotenv.config();

const storage = multer.memoryStorage();
export const bannerUpload = multer({ storage });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BANNER_BUCKET = process.env.BARANDA_BUCKET || process.env.BANNER_BUCKET;
const BANNER_TABLE = process.env.BANNER_TABLE || "banner";

const normalizePageName = (value) => String(value || "").trim().toLowerCase();
const isTableNotFoundError = (error) =>
  error?.name === "ResourceNotFoundException" ||
  error?.__type === "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException";

const scanAllBanners = async () => {
  const items = [];
  let lastKey;

  do {
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: BANNER_TABLE,
        ExclusiveStartKey: lastKey,
      })
    );
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
};

const uploadFileToS3 = async (page, file) => {
  const ext = path.extname(file.originalname || "") || ".jpg";
  const key = `banners/${page}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BANNER_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return {
    key,
    image_url: `https://${BANNER_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
};

export const uploadBanner = async (req, res) => {
  try {
    const page = normalizePageName(req.body?.page);

    if (!page) {
      return res.status(400).json({ error: "page is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "image file is required" });
    }

    if (!req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    if (!BANNER_BUCKET) {
      return res.status(500).json({ error: "Banner bucket is not configured" });
    }

    const { key, image_url } = await uploadFileToS3(page, req.file);
    const now = new Date().toISOString();
    const banner_id = uuidv4();

    const item = {
      banner_id,
      page,
      image_url,
      bucket: BANNER_BUCKET,
      key,
      created_at: now,
      updated_at: now,
    };

    try {
      await ddbDocClient.send(
        new PutCommand({
          TableName: BANNER_TABLE,
          Item: item,
        })
      );
    } catch (dbError) {
      // Rollback uploaded object if metadata write fails.
      if (key) {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: BANNER_BUCKET,
            Key: key,
          })
        );
      }

      if (isTableNotFoundError(dbError)) {
        return res.status(500).json({
          error: `Banner table '${BANNER_TABLE}' not found. Create table and set BANNER_TABLE in .env`,
        });
      }
      throw dbError;
    }

    return res.status(201).json({
      success: true,
      message: "Banner uploaded successfully",
      banner: item,
    });
  } catch (error) {
    console.error("Banner Upload Error:", error);
    return res.status(500).json({ error: "Failed to upload banner" });
  }
};

// GET /api/admin/banner?page=home
export const getBanners = async (req, res) => {
  try {
    const { page = "" } = req.query;
    const pageFilter = normalizePageName(page);

    let banners = await scanAllBanners();

    if (pageFilter) {
      banners = banners.filter(
        (b) => normalizePageName(b.page) === pageFilter
      );
    }

    banners.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
    );

    return res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    if (isTableNotFoundError(error)) {
      return res.status(200).json({
        success: true,
        count: 0,
        banners: [],
        warning: `Banner table '${BANNER_TABLE}' not found. Create table and set BANNER_TABLE in .env`,
      });
    }
    console.error("Get Banners Error:", error);
    return res.status(500).json({ error: "Failed to fetch banners" });
  }
};

// GET /api/admin/banner/:banner_id
export const getBannerById = async (req, res) => {
  try {
    const { banner_id } = req.params;

    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: BANNER_TABLE,
        Key: { banner_id },
      })
    );

    if (!result.Item) {
      return res.status(404).json({ error: "Banner not found" });
    }

    return res.status(200).json({
      success: true,
      banner: result.Item,
    });
  } catch (error) {
    if (isTableNotFoundError(error)) {
      return res.status(500).json({
        error: `Banner table '${BANNER_TABLE}' not found. Create table and set BANNER_TABLE in .env`,
      });
    }
    console.error("Get Banner By ID Error:", error);
    return res.status(500).json({ error: "Failed to fetch banner" });
  }
};

// PUT /api/admin/banner/:banner_id
export const updateBanner = async (req, res) => {
  try {
    const { banner_id } = req.params;
    const page = req.body?.page ? normalizePageName(req.body.page) : undefined;

    const existing = await ddbDocClient.send(
      new GetCommand({
        TableName: BANNER_TABLE,
        Key: { banner_id },
      })
    );

    if (!existing.Item) {
      return res.status(404).json({ error: "Banner not found" });
    }

    if (req.file && !req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    let image_url = existing.Item.image_url;
    let key = existing.Item.key;
    const updateExpr = ["updated_at = :updated_at"];
    const exprValues = {
      ":updated_at": new Date().toISOString(),
    };
    const exprNames = {};

    if (page) {
      updateExpr.push("#page = :page");
      exprNames["#page"] = "page";
      exprValues[":page"] = page;
    }

    if (req.file) {
      const targetPage = page || normalizePageName(existing.Item.page);
      const uploaded = await uploadFileToS3(targetPage, req.file);
      image_url = uploaded.image_url;
      key = uploaded.key;

      updateExpr.push("image_url = :image_url", "#key = :key", "bucket = :bucket");
      exprNames["#key"] = "key";
      exprValues[":image_url"] = image_url;
      exprValues[":key"] = key;
      exprValues[":bucket"] = BANNER_BUCKET;

      if (existing.Item.key) {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: existing.Item.bucket || BANNER_BUCKET,
            Key: existing.Item.key,
          })
        );
      }
    }

    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: BANNER_TABLE,
        Key: { banner_id },
        UpdateExpression: `SET ${updateExpr.join(", ")}`,
        ExpressionAttributeNames:
          Object.keys(exprNames).length > 0 ? exprNames : undefined,
        ExpressionAttributeValues: exprValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      banner: result.Attributes,
    });
  } catch (error) {
    if (isTableNotFoundError(error)) {
      return res.status(500).json({
        error: `Banner table '${BANNER_TABLE}' not found. Create table and set BANNER_TABLE in .env`,
      });
    }
    console.error("Update Banner Error:", error);
    return res.status(500).json({ error: "Failed to update banner" });
  }
};

// DELETE /api/admin/banner/:banner_id
export const deleteBanner = async (req, res) => {
  try {
    const { banner_id } = req.params;

    const existing = await ddbDocClient.send(
      new GetCommand({
        TableName: BANNER_TABLE,
        Key: { banner_id },
      })
    );

    if (!existing.Item) {
      return res.status(404).json({ error: "Banner not found" });
    }

    if (existing.Item.key) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: existing.Item.bucket || BANNER_BUCKET,
          Key: existing.Item.key,
        })
      );
    }

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: BANNER_TABLE,
        Key: { banner_id },
      })
    );

    return res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
      banner_id,
    });
  } catch (error) {
    if (isTableNotFoundError(error)) {
      return res.status(500).json({
        error: `Banner table '${BANNER_TABLE}' not found. Create table and set BANNER_TABLE in .env`,
      });
    }
    console.error("Delete Banner Error:", error);
    return res.status(500).json({ error: "Failed to delete banner" });
  }
};
