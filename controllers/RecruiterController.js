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

const EMPLOYER_TABLE = process.env.EMPLOYER_TABLE; // DynamoDB table name

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

    // Check if employer already exists (by email)
    const existing = await ddbDocClient.send(
      new ScanCommand({
        TableName: EMPLOYER_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email
        }
      })
    );

    if (existing.Items && existing.Items.length > 0) {
      return res.status(400).json({ error: "Employer already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const timestamp = new Date().toISOString();
    const employer_id = Date.now().toString(); // or use uuid.v4()

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

    // Find employer by email
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
      return res.status(404).json({ error: "Employer not found" });
    }

    const employer = result.Items[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, employer.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate JWT
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

// -----------------------------------------
// ✅ Update Employer Profile
// -----------------------------------------
export const updateProfile = async (req, res) => {
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
