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
const PAGE_SIZE = 20;

const scanAllItems = async (tableName) => {
  const items = [];
  let lastKey;

  do {
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      })
    );
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

const isFreeUser = (user) => {
  if (user.premium_user === true) return false;
  const plan = String(user.plan || "").toLowerCase().trim();
  return plan !== "premium";
};



// AWS S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// ✅ Register Student
export const registerStudent = async (req, res) => {
  try {
    const { full_name, email, password, phone_number, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const timestamp = new Date().toISOString();
    const user_id = Date.now().toString();

    const newUser = {
      user_id,
      full_name,
      email,
      password: hashedPassword,
      phone_number,
      role,
      status: "Active",
      is_admin_closed: false,       // 👈 NEW FIELD
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

    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: { ":email": email }
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

    // 🛑 Check if admin disabled the account
    if (user.is_admin_closed === true) {
      return res.status(403).json({
        error: "Your account is blocked or deleted by admin",
      });
    }

    // 🟢 Generate JWT Token for allowed users
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
        Bucket: process.env.S3_BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const logoUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    // Update ONLY logo field in DynamoDB
    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.USERS_TABLE,
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


export const setManualPlan = async (req, res) => {
  try {
    const { email, is_manual_plan } = req.body;

    if (!email || typeof is_manual_plan !== "string" || !is_manual_plan.trim()) {
      return res.status(400).json({
        error: "email and is_manual_plan (string) are required",
      });
    }

    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { email },
        UpdateExpression:
          "SET is_manual_plan = :isManualPlan, #updated_at = :updated_at",
        ExpressionAttributeNames: {
          "#updated_at": "updated_at",
        },
        ExpressionAttributeValues: {
          ":isManualPlan": is_manual_plan.toLowerCase().trim(),
          ":updated_at": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return res.status(200).json({
      message: "Manual plan updated successfully",
      user: result.Attributes,
    });
  } catch (error) {
    console.error("Error setting manual plan:", error);
    return res.status(500).json({ error: "Failed to update manual plan" });
  }
};

export const markStudentPremium = async (req, res) => {
  try {
    const { email, is_premium, plan } = req.body;

    if (!email || typeof is_premium !== "boolean" || !plan) {
      return res
        .status(400)
        .json({ error: "student_email, is_premium (boolean), and plan are required" });
    }

    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { email },
      UpdateExpression: "SET premium_user = :isPremium, #p = :plan",
      ExpressionAttributeNames: {
        "#p": "plan",  // alias for reserved keyword
      },
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




// GET /api/students/users — paginated user list with filters
export const getUserList = async (req, res) => {
  try {
    const {
      page = "1",
      email = "",
      full_name = "",
      gender = "",
      sort = "newest",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const users = await scanAllItems(USERS_TABLE);

    let list = users
      .map((user) => sanitizeUser(user))
      .filter(isFreeUser);

    if (email) {
      const q = email.toLowerCase().trim();
      list = list.filter((u) =>
        String(u.email || "").toLowerCase().includes(q)
      );
    }

    if (full_name) {
      const q = full_name.toLowerCase().trim();
      list = list.filter((u) =>
        String(u.full_name || "").toLowerCase().includes(q)
      );
    }

    if (gender) {
      const q = gender.toLowerCase().trim();
      list = list.filter((u) =>
        String(u.gender || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (pageNum - 1) * PAGE_SIZE;
    const data = list.slice(start, start + PAGE_SIZE);

    return res.status(200).json({
      success: true,
      page: pageNum,
      limit: PAGE_SIZE,
      total,
      total_pages: totalPages,
      showing: data.length,
      users: data,
    });
  } catch (error) {
    console.error("Error fetching user list:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch user list",
    });
  }
};

export const getPremiumPrices = async (req, res) => {
  try {
    // Fetch subscription prices for static subscription_id = 'default'
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: SUBSCRIPTION_TABLE,
        Key: {
          email: "john900009@example.com",
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