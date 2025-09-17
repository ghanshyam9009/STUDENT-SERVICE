import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

const USERS_TABLE = process.env.USERS_TABLE;

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

// ✅ Update Profile (protected route)import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
export const updateProfile = async (req, res) => {
    try {
      const email = req.params.email; // now use email from path
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
  
      exprAttrNames["#updated_at"] = "updated_at";
      exprAttrValues[":updated_at"] = new Date().toISOString();
      updateExpr.push("#updated_at = :updated_at");
  
      const updateExp = `SET ${updateExpr.join(", ")}`;
  
      const result = await ddbDocClient.send(
        new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email }, // ✅ must match table PK
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
  
