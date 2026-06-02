import "../config/env.js";
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

const storage = multer.memoryStorage();
export const bannerUpload = multer({ storage });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const getBannerBucket = () =>
  String(
    process.env.BANNER_BUCKET || process.env.BARANDA_BUCKET || ""
  ).trim();

const BANNER_TABLE = process.env.BANNER_TABLE || "banner";

const normalizePageName = (value) => String(value || "").trim().toLowerCase();
const isTableNotFoundError = (error) =>
  error?.name === "ResourceNotFoundException" ||
  error?.__type === "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException";

const isNetworkError = (error) =>
  error?.code === "ENOTFOUND" ||
  error?.code === "ECONNREFUSED" ||
  error?.code === "ETIMEDOUT";

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

const uploadFileToS3 = async (page, file, bucket) => {
  const ext = path.extname(file.originalname || "") || ".jpg";
  const key = `banners/${page}/${uuidv4()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return {
    key,
    image_url: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
};

/** Resolve S3 object key from stored key or image_url */
const resolveS3Key = (item, bucket) => {
  if (item?.key) return item.key;
  const url = item?.image_url;
  if (!url || typeof url !== "string") return null;

  try {
    const parsed = new URL(url);
    const pathKey = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (pathKey) return pathKey;
  } catch {
    /* fall through */
  }

  if (bucket && url.includes(`${bucket}.s3.`)) {
    const marker = ".amazonaws.com/";
    const idx = url.indexOf(marker);
    if (idx !== -1) return decodeURIComponent(url.slice(idx + marker.length));
  }

  return null;
};

const deleteBannerImageFromS3 = async (item, fallbackBucket) => {
  const bucket = item?.bucket || fallbackBucket;
  const key = resolveS3Key(item, bucket);
  if (!bucket || !key) return;

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  } catch (err) {
    console.warn("Failed to delete old banner image from S3:", key, err.message);
  }
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

    const bucket = getBannerBucket();
    if (!bucket) {
      return res.status(500).json({
        error:
          "Banner bucket is not configured. Set BANNER_BUCKET in .env and restart the server.",
      });
    }

    const { key, image_url } = await uploadFileToS3(page, req.file, bucket);
    const now = new Date().toISOString();

    // Same page par purane banners: S3 image delete + record replace
    const existingForPage = (await scanAllBanners()).filter(
      (b) => normalizePageName(b.page) === page
    );

    let banner_id = uuidv4();
    let created_at = now;

    if (existingForPage.length > 0) {
      const primary = existingForPage.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0).getTime() -
          new Date(a.updated_at || a.created_at || 0).getTime()
      )[0];
      banner_id = primary.banner_id;
      created_at = primary.created_at || now;

      for (const old of existingForPage) {
        await deleteBannerImageFromS3(old, bucket);
        if (old.banner_id !== banner_id) {
          await ddbDocClient.send(
            new DeleteCommand({
              TableName: BANNER_TABLE,
              Key: { banner_id: old.banner_id },
            })
          );
        }
      }
    }

    const item = {
      banner_id,
      page,
      image_url,
      bucket,
      key,
      created_at,
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
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (isTableNotFoundError(dbError)) {
        return res.status(500).json({
          error: `Banner table '${BANNER_TABLE}' not found. Create table and set BANNER_TABLE in .env`,
        });
      }
      throw dbError;
    }

    return res.status(existingForPage.length > 0 ? 200 : 201).json({
      success: true,
      message:
        existingForPage.length > 0
          ? "Banner replaced successfully (old image removed)"
          : "Banner uploaded successfully",
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
    if (isNetworkError(error)) {
      return res.status(503).json({
        error:
          "Cannot reach DynamoDB. Check internet/DNS or set DNS_SERVERS=8.8.8.8,8.8.4.4 in .env and restart.",
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

    let oldImageSnapshot = null;

    if (req.file) {
      const bucket = getBannerBucket();
      if (!bucket) {
        return res.status(500).json({
          error:
            "Banner bucket is not configured. Set BANNER_BUCKET in .env and restart the server.",
        });
      }

      const targetPage = page || normalizePageName(existing.Item.page);
      const uploaded = await uploadFileToS3(targetPage, req.file, bucket);
      image_url = uploaded.image_url;
      key = uploaded.key;
      oldImageSnapshot = { ...existing.Item };

      updateExpr.push(
        "image_url = :image_url",
        "#key = :key",
        "#bucket = :bucket"
      );
      exprNames["#key"] = "key";
      exprNames["#bucket"] = "bucket";
      exprValues[":image_url"] = image_url;
      exprValues[":key"] = key;
      exprValues[":bucket"] = bucket;
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

    // DB update ke baad purani S3 image delete — nayi URL ab record mein hai
    if (oldImageSnapshot) {
      const bucket = getBannerBucket();
      await deleteBannerImageFromS3(oldImageSnapshot, bucket);
    }

    return res.status(200).json({
      success: true,
      message: req.file
        ? "Banner updated successfully (old image removed)"
        : "Banner updated successfully",
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

    await deleteBannerImageFromS3(existing.Item, getBannerBucket());

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
