import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PutCommand,DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();
export const upload = multer({ storage });

dotenv.config();

const USERS_TABLE = process.env.USERS_TABLE;
const SUBSCRIPTION_TABLE = process.env.SUBSCRIPTION_TABLE;



// AWS S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// ✅ Register Student
export const registerStudent = async (req, res) => {
  try {
    const { full_name, email, password, phone_number, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const timestamp = new Date().toISOString();

    // user_id = timestamp string for uniqueness
    const user_id = Date.now().toString();

    const newUser = {
      user_id,
      full_name,
      email,
      password: hashedPassword,
      phone_number,
      role,
      status: "Active",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: newUser,
      })
    );

    return res.status(201).json({ message: "User registered successfully", user_id });
  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({ error: "Registration failed" });
  }
};

// ✅ Login Student
export const loginStudent = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
  
      // 🔹 Scan table to find user by email
      const result = await ddbDocClient.send(
        new ScanCommand({
          TableName: USERS_TABLE,
          FilterExpression: "email = :email",
          ExpressionAttributeValues: {
            ":email": email
          }
        })
      );
  
      if (!result.Items || result.Items.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
  
      const user = result.Items[0];
  
      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
  
      // Generate JWT
      const token = jwt.sign(
        { user_id: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
  
      return res.json({ message: "Login successful", token, user });
    } catch (err) {
      console.error("Login Error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  };



export const updateProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const updateData = { ...req.body };  // ensure plain object

    // If a file is uploaded
    if (req.file) {
      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `documents/${email}_${Date.now()}${fileExt}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      updateData.resumeUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
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
        TableName: process.env.USERS_TABLE,
        Key: { email },
        UpdateExpression: updateExp,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return res.json({
      message: "Profile updated successfully",
      profile: result.Attributes,
    });
  } catch (err) {
    console.error("Profile Update Error:", err);
    return res.status(500).json({ error: "Profile update failed" });
  }
};




export const markStudentPremium = async (req, res) => {
  try {
    const { student_email, is_premium, plan } = req.body;

    if (!student_email || typeof is_premium !== "boolean" || !plan) {
      return res
        .status(400)
        .json({ error: "student_email, is_premium (boolean), and plan are required" });
    }

    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { student_email },
      UpdateExpression: "SET premium_user = :isPremium, plan = :plan",
      ExpressionAttributeValues: {
        ":isPremium": is_premium,
        ":plan": plan,
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await ddbDocClient.send(updateCommand);

    return res.status(200).json({
      message: `Student ${is_premium ? "marked" : "unmarked"} as premium successfully.`,
      student: result.Attributes,
    });
  } catch (error) {
    console.error("Error updating student premium_user:", error);
    return res.status(500).json({ error: "Failed to update premium status for student" });
  }
};




export const getPremiumPrices = async (req, res) => {
  try {
    // Fetch subscription prices for static subscription_id = 'default'
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: SUBSCRIPTION_TABLE,
        Key: {
          subscription_id: "default",
        },
      })
    );

    if (!result.Item) {
      return res.status(404).json({ error: "Subscription prices not found" });
    }

    return res.status(200).json({
      subscription: result.Item,
    });
  } catch (error) {
    console.error("Error fetching subscription prices:", error);
    return res.status(500).json({ error: "Failed to fetch subscription prices" });
  }
};