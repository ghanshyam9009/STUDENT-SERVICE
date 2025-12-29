import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  PutCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";

import multer from "multer";
import path from "path";



// Multer setup (use memory storage since uploading directly to S3)
const storage = multer.memoryStorage();
export const upload = multer({ storage });

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
// import path from "path";

// S3 client (same region for both buckets)


import dotenv from "dotenv";

dotenv.config();

const EMPLOYER_TABLE = process.env.EMPLOYER_TABLE; // DynamoDB table name

const s3Client = new S3Client({ region: process.env.AWS_REGION });

// -----------------------------------------
// ✅ Register Employer
// -----------------------------------------
export const registerEmployer = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone_number,
      company_name,
      company_website,
      industry,
      company_size,
      location,
      description
    } = req.body;

    if (!full_name || !email || !password || !company_name) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const existing = await ddbDocClient.send(
      new ScanCommand({
        TableName: EMPLOYER_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: { ":email": email }
      })
    );

    if (existing.Items && existing.Items.length > 0) {
      return res.status(400).json({ error: "Employer already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const timestamp = new Date().toISOString();
    const employer_id = Date.now().toString();

    const newEmployer = {
      employer_id,
      full_name,
      email,
      password: hashedPassword,
      phone_number,
      company_name,
      company_website: company_website || null,
      industry: industry || null,
      company_size: company_size || null,
      location: location || null,
      description: description || null,
      status: "Active",
      is_admin_closed: false,     // 👈 NEW FIELD ADDED
      created_at: timestamp,
      updated_at: timestamp,
      role: "Employer"
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: EMPLOYER_TABLE,
        Item: newEmployer
      })
    );

    return res.status(201).json({
      message: "Employer registered successfully",
      employer_id
    });
  } catch (err) {
    console.error("Employer Register Error:", err);
    return res.status(500).json({ error: "Employer registration failed" });
  }
};


// -----------------------------------------
// ✅ Login Employer
// -----------------------------------------
export const loginEmployer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: EMPLOYER_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: { ":email": email }
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return res.status(404).json({ error: "Employer not found" });
    }

    const employer = result.Items[0];

    const isMatch = await bcrypt.compare(password, employer.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // 🛑 Check admin status
    if (employer.is_admin_closed === true) {
      return res.status(403).json({
        error: "Your account is blocked or deleted by admin",
      });
    }

    const token = jwt.sign(
      { employer_id: employer.employer_id, role: "Employer" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "Login successful",
      token,
      employer
    });
  } catch (err) {
    console.error("Employer Login Error:", err);
    return res.status(500).json({ error: "Employer login failed" });
  }
};





export const updateEmployerProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const updateData = { ...req.body }; // ensure plain object

    // If KYC document uploaded
    if (req.file) {
      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `kyc/${email}_${Date.now()}${fileExt}`;

      // Upload to KYC S3 bucket
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.KYC_BUCKET, // new bucket for recruiter docs
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      // Save S3 file URL in DynamoDB field
      updateData.kycDocUrl = `https://${process.env.KYC_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No data provided to update" });
    }

    const updateExpr = [];
    const exprAttrNames = {};
    const exprAttrValues = {};

    Object.keys(updateData).forEach((key) => {
      updateExpr.push(`#${key} = :${key}`);
      exprAttrNames[`#${key}`] = key;
      exprAttrValues[`:${key}`] = updateData[key];
    });

    // Safe hasOwnProperty check
    if (!Object.prototype.hasOwnProperty.call(updateData, "updated_at")) {
      exprAttrNames["#updated_at"] = "updated_at";
      exprAttrValues[":updated_at"] = new Date().toISOString();
      updateExpr.push("#updated_at = :updated_at");
    }

    const updateExp = `SET ${updateExpr.join(", ")}`;

    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.EMPLOYER_TABLE,
        Key: { email },
        UpdateExpression: updateExp,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return res.json({
      message: "Employer profile updated successfully",
      profile: result.Attributes,
    });
  } catch (err) {
    console.error("Employer Profile Update Error:", err);
    return res.status(500).json({ error: "Employer profile update failed" });
  }
};



export const updateLogo = async (req, res) => {
  try {
    const email = req.params.email;

    if (!req.file) {
      return res.status(400).json({ error: "Logo file is required" });
    }

    // ✅ Allow only images
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    const file = req.file;
    const fileExt = path.extname(file.originalname);
    const fileName = `logos/${email}_${Date.now()}${fileExt}`;

    // Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.KYC_BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const logoUrl = `https://${process.env.KYC_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    // Update ONLY logo field in DynamoDB
    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.EMPLOYER_TABLE,
        Key: { email },
        UpdateExpression: "SET #logo = :logo, #updated_at = :updated_at",
        ExpressionAttributeNames: {
          "#logo": "logo",
          "#updated_at": "updated_at",
        },
        ExpressionAttributeValues: {
          ":logo": logoUrl,
          ":updated_at": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return res.json({
      message: "Logo updated successfully",
      logo: logoUrl,
      profile: result.Attributes,
    });

  } catch (err) {
    console.error("Logo Update Error:", err);
    return res.status(500).json({ error: "Logo update failed" });
  }
};
