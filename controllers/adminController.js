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
const STUDENT_TABLE = process.env.USERS_TABLE;
const JOB_TABLE = process.env.JOB_TABLE;
const PLANS_TABLE = process.env.PLANS_TABLE || "plans";
const PAGE_SIZE = 10;

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

const sanitizeEmployer = (employer) => {
  if (!employer) return null;
  const { password, ...safe } = employer;
  return safe;
};

const sanitizeCandidate = (candidate) => {
  if (!candidate) return null;
  const { password, ...safe } = candidate;
  return safe;
};

const getEmployerStatus = (employer) => {
  if (employer?.hasadminapproved === true) return "Approved";
  return "Pending";
};

const getJobsPostedCountMap = (jobs) => {
  const map = new Map();
  for (const job of jobs) {
    if (!job.employer_id) continue;
    const key = String(job.employer_id);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
};
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





// GET /api/admin/get-all-recruiter
export const getAllRecruiters = async (req, res) => {
  try {
    const {
      page = "1",
      status = "",
      search = "",
      company_name = "",
      contact_name = "",
      industry = "",
      date_from = "",
      date_to = "",
      sort = "newest",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const [employers, jobs] = await Promise.all([
      scanAllItems(EMPLOYER_TABLE),
      scanAllItems(JOB_TABLE),
    ]);

    const jobsPostedMap = getJobsPostedCountMap(jobs);

    let list = employers.map((employer) => {
      const safe = sanitizeEmployer(employer);
      return {
        ...safe,
        status_label: getEmployerStatus(employer),
        jobs_posted_count: jobsPostedMap.get(String(employer.employer_id)) || 0,
      };
    });

    if (company_name) {
      const q = company_name.toLowerCase().trim();
      list = list.filter((e) =>
        String(e.company_name || "").toLowerCase().includes(q)
      );
    }

    if (contact_name) {
      const q = contact_name.toLowerCase().trim();
      list = list.filter((e) =>
        String(e.full_name || "").toLowerCase().includes(q)
      );
    }

    if (industry) {
      const q = industry.toLowerCase().trim();
      list = list.filter((e) =>
        String(e.industry || "").toLowerCase().includes(q)
      );
    }

    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter((e) => {
        const fields = [
          e.company_name,
          e.email,
          e.full_name,
          e.industry,
          e.location,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        return fields.some((v) => v.includes(q));
      });
    }

    if (date_from) {
      const from = new Date(date_from).getTime();
      list = list.filter((e) => {
        const joinedAt = new Date(e.created_at || 0).getTime();
        return !Number.isNaN(from) && joinedAt >= from;
      });
    }

    if (date_to) {
      const to = new Date(date_to).getTime();
      list = list.filter((e) => {
        const joinedAt = new Date(e.created_at || 0).getTime();
        return !Number.isNaN(to) && joinedAt <= to;
      });
    }

    const counts = {
      all: list.length,
      approved: list.filter((e) => e.status_label === "Approved").length,
      pending: list.filter((e) => e.status_label === "Pending").length,
    };

    if (status) {
      const statusFilter = status.toLowerCase();
      list = list.filter(
        (e) => e.status_label.toLowerCase() === statusFilter
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
      counts,
      filters: {
        statuses: ["Approved", "Pending"],
      },
      recruiters: data,
      data,
    });
  } catch (error) {
    console.error("Error fetching recruiters:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch recruiters",
    });
  }
};


// GET /api/admin/get-all-candidates
export const getAllcandidates = async (req, res) => {
  try {
    const {
      page = "1",
      search = "",
      name = "",
      email = "",
      plan_id = "",
      date_from = "",
      date_to = "",
      sort = "newest",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const [students, plans] = await Promise.all([
      scanAllItems(STUDENT_TABLE),
      scanAllItems(PLANS_TABLE),
    ]);

    const candidatePlans = plans
      .filter((p) => String(p.type || "").toLowerCase() === "candidate")
      .sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
      );

    let list = students.map((student) => {
      const safe = sanitizeCandidate(student);
      const planValue = String(student.plan || "").toLowerCase();
      const matchedPlan = candidatePlans.find(
        (p) =>
          String(p.plan_id || "").toLowerCase() === planValue ||
          String(p.name || "").toLowerCase() === planValue
      );
      return {
        ...safe,
        membership_type: student.premium_user
          ? String(student.plan || "PREMIUM").toUpperCase()
          : String(student.plan || "BASIC").toUpperCase(),
        plan_id: matchedPlan?.plan_id || student.plan_id || null,
        plan_name: matchedPlan?.name || student.plan || null,
      };
    });

    if (name) {
      const q = name.toLowerCase().trim();
      list = list.filter((c) =>
        String(c.full_name || "").toLowerCase().includes(q)
      );
    }

    if (email) {
      const q = email.toLowerCase().trim();
      list = list.filter((c) =>
        String(c.email || "").toLowerCase().includes(q)
      );
    }

    if (plan_id) {
      const selectedPlan = candidatePlans.find((p) => p.plan_id === plan_id);
      list = list.filter((c) => {
        const candidatePlanId = String(c.plan_id || "").toLowerCase();
        const candidatePlan = String(c.plan || c.plan_name || "").toLowerCase();
        const targetId = String(plan_id).toLowerCase();
        const targetName = String(selectedPlan?.name || "").toLowerCase();
        return (
          candidatePlanId === targetId ||
          candidatePlan === targetId ||
          (targetName && candidatePlan === targetName)
        );
      });
    }

    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter((c) => {
        const fields = [c.full_name, c.email, c.phone_number, c.plan_name]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        return fields.some((v) => v.includes(q));
      });
    }

    if (date_from) {
      const from = new Date(date_from).getTime();
      list = list.filter((c) => {
        const joinedAt = new Date(c.created_at || 0).getTime();
        return !Number.isNaN(from) && joinedAt >= from;
      });
    }

    if (date_to) {
      const to = new Date(date_to).getTime();
      list = list.filter((c) => {
        const joinedAt = new Date(c.created_at || 0).getTime();
        return !Number.isNaN(to) && joinedAt <= to;
      });
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
      filters: {
        plans: candidatePlans.map((p) => ({
          plan_id: p.plan_id,
          name: p.name,
          type: p.type,
          price: p.price,
        })),
      },
      candidates: data,
      data,
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch candidates",
    });
  }
};




// export const blockEmployerByAdmin = async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({ error: "employer_id is required" });
//     }

//     await ddbDocClient.send(
//       new UpdateCommand({
//         TableName: EMPLOYER_TABLE,
//         Key: { email },
//         UpdateExpression: "SET is_admin_closed = :val",
//         ExpressionAttributeValues: {
//           ":val": true,
//         },
//       })
//     );

//     return res.json({ message: "Employer has been blocked by admin" });
//   } catch (err) {
//     console.error("Block Employer Error:", err);
//     return res.status(500).json({ error: "Failed to block employer" });
//   }
// };


// // import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

// export const blockStudentByAdmin = async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({ error: "user_id is required" });
//     }

//     await ddbDocClient.send(
//       new UpdateCommand({
//         TableName: STUDENT_TABLE,
//         Key: { email },
//         UpdateExpression: "SET is_admin_closed = :val",
//         ExpressionAttributeValues: {
//           ":val": true,
//         },
//       })
//     );

//     return res.json({ message: "Student has been blocked by admin" });
//   } catch (err) {
//     console.error("Block Student Error:", err);
//     return res.status(500).json({ error: "Failed to block student" });
//   }
// };

// import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

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

    return res.status(200).json({
      message: "Employer has been blocked by admin",
    });
  } catch (err) {
    console.error("Block Employer Error:", err);
    return res.status(500).json({ error: "Failed to block employer" });
  }
};

export const blockStudentByAdmin = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: STUDENT_TABLE,
        Key: { email },
        UpdateExpression: "SET is_admin_closed = :val",
        ExpressionAttributeValues: {
          ":val": true,
        },
      })
    );

    return res.status(200).json({
      message: "Student has been blocked by admin",
    });
  } catch (err) {
    console.error("Block Student Error:", err);
    return res.status(500).json({ error: "Failed to block student" });
  }
};
