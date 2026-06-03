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
const JOB_TABLE = process.env.JOB_TABLE;
const TASK_TABLE = process.env.TASK_TABLE;
const APPLIED_TABLE = process.env.APPLIED_TABLE;
const PAGE_SIZE = 10;

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

const getLatestTaskByJobMap = (tasks) => {
  const map = new Map();

  for (const task of tasks) {
    if (!task.job_id) continue;

    const existing = map.get(task.job_id);
    const existingTime = new Date(
      existing?.updated_at || existing?.created_at || 0
    ).getTime();
    const currentTime = new Date(task.updated_at || task.created_at || 0).getTime();

    if (!existing || currentTime >= existingTime) {
      map.set(task.job_id, task);
    }
  }

  return map;
};

const getTasksByJobMap = (tasks) => {
  const map = new Map();
  for (const task of tasks) {
    if (!task.job_id) continue;
    if (!map.has(task.job_id)) map.set(task.job_id, []);
    map.get(task.job_id).push(task);
  }
  return map;
};

const getApplicationCountByJobMap = (appliedJobs) => {
  const map = new Map();
  for (const applied of appliedJobs) {
    if (!applied.job_id) continue;
    map.set(applied.job_id, (map.get(applied.job_id) || 0) + 1);
  }
  return map;
};

const normalizeTab = (tab = "all") => {
  const value = String(tab).toLowerCase().trim();
  if (["all", "new", "edit", "close", "reopen"].includes(value)) return value;
  return "all";
};

const isTruthy = (value) => {
  if (value === true) return true;
  const normalized = String(value || "").toLowerCase().trim();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const isApprovedJob = (job, latestTask) => {
  const statusVerified = String(job?.status_verified || "").toLowerCase();
  const isVisible = isTruthy(job?.to_show_user);
  return statusVerified === "verified" && isVisible;
};

const matchesTab = (job, latestTask, allTasks, tab) => {
  if (tab === "all") return true;
  const taskCategory = String(latestTask?.category || "").toLowerCase();
  const jobStatus = String(job?.status || "").toLowerCase();
  const categories = (allTasks || []).map((t) =>
    String(t?.category || "").toLowerCase()
  );

  if (tab === "new") return categories.includes("postnewjob") || taskCategory === "postnewjob";
  if (tab === "edit") return categories.includes("editjob") || taskCategory === "editjob";
  if (tab === "close") {
    return categories.includes("closejob") || taskCategory === "closejob" || jobStatus === "closed";
  }
  if (tab === "reopen") {
    return categories.includes("reopenjob") || taskCategory === "reopenjob";
  }
  return true;
};

// GET /api/Recruiter/jobs
export const getAllRecruiterJob = async (req, res) => {
  try {
    const {
      recruiter_id = "",
      page = "1",
      tab = "all",
      company_name = "",
      recruiter_name = "",
      job_title = "",
      search = "",
      sort = "newest",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const normalizedTab = normalizeTab(tab);

    const [jobs, tasks, appliedJobs, recruiters] = await Promise.all([
      scanAllItems(JOB_TABLE),
      scanAllItems(TASK_TABLE),
      scanAllItems(APPLIED_TABLE),
      scanAllItems(EMPLOYER_TABLE),
    ]);

    const recruiterMap = new Map(
      recruiters
        .filter((r) => r.employer_id)
        .map((recruiter) => [String(recruiter.employer_id), recruiter])
    );
    const latestTaskMap = getLatestTaskByJobMap(tasks);
    const tasksByJobMap = getTasksByJobMap(tasks);
    const applicationCountMap = getApplicationCountByJobMap(appliedJobs);

    let list = jobs.map((job) => {
      const recruiter = recruiterMap.get(String(job.employer_id)) || null;
      const latestTask = latestTaskMap.get(job.job_id) || null;
      const allTasks = tasksByJobMap.get(job.job_id) || [];
      return {
        ...job,
        recruiter_name: recruiter?.full_name || null,
        recruiter_email: recruiter?.email || null,
        latest_task: latestTask,
        tasks: allTasks,
        tab_category: latestTask?.category || null,
        applications_count: applicationCountMap.get(job.job_id) || 0,
      };
    });

    // Only recruiter-side jobs should appear in this report.
    // Keep this inclusive because legacy rows may miss posted_by/job_type values.
    list = list.filter((job) => {
      const postedBy = String(job.posted_by || "").toUpperCase();
      const hasRecruiter = Boolean(job.employer_id);
      const isDeleted = isTruthy(job.is_delete);
      const hasRecruiterProfile = recruiterMap.has(String(job.employer_id));
      const looksLikeRecruiterJob =
        postedBy === "RECRUITER" || postedBy === "";
      return (
        looksLikeRecruiterJob &&
        hasRecruiter &&
        hasRecruiterProfile &&
        !isDeleted
      );
    });

    if (recruiter_id) {
      list = list.filter((job) => String(job.employer_id) === String(recruiter_id));
    }

    // "All" tab should only show approved jobs.
    if (normalizedTab === "all") {
      list = list.filter((job) => isApprovedJob(job, job.latest_task));
    }

    list = list.filter((job) =>
      matchesTab(job, job.latest_task, job.tasks, normalizedTab)
    );

    if (company_name) {
      const q = company_name.toLowerCase().trim();
      list = list.filter((job) =>
        String(job.company_name || job.posted_company_name || "")
          .toLowerCase()
          .includes(q)
      );
    }

    if (recruiter_name) {
      const q = recruiter_name.toLowerCase().trim();
      list = list.filter((job) =>
        String(job.recruiter_name || "").toLowerCase().includes(q)
      );
    }

    if (job_title) {
      const q = job_title.toLowerCase().trim();
      list = list.filter((job) =>
        String(job.job_title || "").toLowerCase().includes(q)
      );
    }

    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter((job) => {
        const candidates = [
          job.job_title,
          job.company_name,
          job.posted_company_name,
          job.recruiter_name,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        return candidates.some((v) => v.includes(q));
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
      tab: normalizedTab,
      page: pageNum,
      limit: PAGE_SIZE,
      total,
      total_pages: totalPages,
      showing: data.length,
      data,
    });
  } catch (err) {
    console.error("Get Recruiter Jobs Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch recruiter jobs",
    });
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
