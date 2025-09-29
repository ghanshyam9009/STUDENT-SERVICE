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

const ADMIN_TABLE = process.env.ADMIN_TABLE; // or process.env.ADMINS_TABLE if using a separate table

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
