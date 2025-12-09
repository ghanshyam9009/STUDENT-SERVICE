import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  PutCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

import express from "express";

const app = express();

app.use(express.json()); 

const ADMIN_TABLE = process.env.ADMIN_TABLE; // or process.env.ADMINS_TABLE if using a separate table
const SUBSCRIPTION_TABLE = process.env.SUBSCRIPTION_TABLE;
const EMPLOYER_TABLE = process.env.EMPLOYER_TABLE; // DynamoDB table name
const STUDENT_TABLE = process.env.USERS_TABLE
// ✅ Register Admin
export const registerAdmin = async (req, res) => {
  try {
    const { full_name, email, password, phone_number, role } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // Force role as Admin if you don’t want to trust client
    const adminRole = role || "Admin";

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const timestamp = new Date().toISOString();
    const user_id = Date.now().toString();

    const newAdmin = {
      user_id,
      full_name,
      email,
      password: hashedPassword,
      phone_number,
      role: adminRole,
      status: "Active",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: ADMIN_TABLE,
        Item: newAdmin,
      })
    );

    return res
      .status(201)
      .json({ message: "Admin registered successfully", user_id });
  } catch (err) {
    console.error("Admin Register Error:", err);
    return res.status(500).json({ error: "Admin registration failed" });
  }
};

// ✅ Login Admin
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find admin by email
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: ADMIN_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
          // ":role": "Admin",
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const admin = result.Items[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: admin.user_id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({ message: "Login successful", token, admin });
  } catch (err) {
    console.error("Admin Login Error:", err);
    return res.status(500).json({ error: "Admin login failed" });
  }
};

// ✅ Update Admin Profile
export const updateAdminProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const updateData = req.body;

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

    // Only add updated_at if it’s not already in the body
    if (!updateData.hasOwnProperty("updated_at")) {
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



// Update subscription prices for plans
export const updatePremiumPrices = async (req, res) => {
  try {
    const {email, gold, platinum, silver } = req.body;

    // Basic validation - all three prices should be present and numbers
    if (
      gold === undefined ||
      platinum === undefined ||
      silver === undefined ||
      isNaN(gold) ||
      isNaN(platinum) ||
      isNaN(silver)
    ) {
      return res.status(400).json({
        error: "gold, platinum, and silver prices are required and must be numbers",
      });
    }

    // We can store these prices as one item with a fixed id (e.g. subscription_id = 'default')
    const subscriptionItem = {
      subscription_id: "default", // static ID for single subscription record
      email,
      gold: Number(gold),
      platinum: Number(platinum),
      silver: Number(silver),
      updated_at: new Date().toISOString(),
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: SUBSCRIPTION_TABLE,
        Item: subscriptionItem,
      })
    );

    return res.status(200).json({
      message: "Subscription prices updated successfully",
      subscription: subscriptionItem,
    });
  } catch (error) {
    console.error("Error updating subscription prices:", error);
    return res.status(500).json({ error: "Failed to update subscription prices" });
  }
};



export const approveRecruiter = async (req, res) => {
  try {
    const email = req.body?.email;

    if (!email) {
      return res.status(400).json({ error: "Recruiter email is required in request body." });
    }

    // 🔍 Find recruiter by email
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: EMPLOYER_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email
        }
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return res.status(404).json({ error: "Recruiter not found" });
    }

    const recruiter = result.Items[0];

    // ✅ Update using correct key (email is the partition key)
    const updateResult = await ddbDocClient.send(
      new UpdateCommand({
        TableName: EMPLOYER_TABLE,
        Key: {
          email: recruiter.email // ✅ Must match the table's key schema
        },
        UpdateExpression: "SET hasadminapproved = :approved",
        ExpressionAttributeValues: {
          ":approved": true
        },
        ReturnValues: "ALL_NEW"
      })
    );

    return res.status(200).json({
      message: "Recruiter approved successfully",
      recruiter: updateResult.Attributes
    });

  } catch (error) {
    console.error("Error approving recruiter:", error);
    return res.status(500).json({ error: "Failed to approve recruiter" });
  }
};





export const getAllRecruiters = async (req, res) => {
  try {
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: EMPLOYER_TABLE
      })
    );

    const recruiters = result.Items || [];

    return res.status(200).json({
      count: recruiters.length,
      recruiters
    });
  } catch (error) {
    console.error("Error fetching recruiters:", error);
    return res.status(500).json({ error: "Failed to fetch recruiters" });
  }
};


export const getAllcandidates = async (req, res) => {
  try {
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: STUDENT_TABLE
      })
    );

    const recruiters = result.Items || [];

    return res.status(200).json({
      count: recruiters.length,
      recruiters
    });
  } catch (error) {
    console.error("Error fetching recruiters:", error);
    return res.status(500).json({ error: "Failed to fetch recruiters" });
  }
};



import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const blockStudentByAdmin = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { email },
        UpdateExpression: "SET is_admin_closed = :val",
        ExpressionAttributeValues: {
          ":val": true,
        },
      })
    );

    return res.json({ message: "Student has been blocked by admin" });
  } catch (err) {
    console.error("Block Student Error:", err);
    return res.status(500).json({ error: "Failed to block student" });
  }
};



export const blockEmployerByAdmin = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: EMPLOYER_TABLE,
        Key: { email },
        UpdateExpression: "SET is_admin_closed = :val",
        ExpressionAttributeValues: {
          ":val": true,
        },
      })
    );

    return res.json({ message: "Employer has been blocked by admin" });
  } catch (err) {
    console.error("Block Employer Error:", err);
    return res.status(500).json({ error: "Failed to block employer" });
  }
};
