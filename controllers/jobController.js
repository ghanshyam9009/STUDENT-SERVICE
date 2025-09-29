// import { PutCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import {
  PutCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
dotenv.config();

const JOB_TABLE = process.env.JOB_TABLE;
const GOV_JOB_TABLE = process.env.GOV_JOB_TABLE;
const TASK_TABLE = process.env.TASK_TABLE; // replace with your Task table name
// -----------------------------------------
// ✅ Post a Job
// -----------------------------------------
export const postJob = async (req, res) => {
  try {
    const {
      job_title,
      description,
      location,
      salary_range,
      employment_type,
      skills_required,
      experience_required,
      company_name,
      work_mode,
      responsibilities,
      qualifications,
      application_deadline,
      contact_email,
      job_status
    } = req.body;

    // ✅ Employer/Recruiter ID from JWT middleware or request body
    const employer_id = req.user?.employer_id || req.body.employer_id;

    if (!employer_id || !job_title || !description || !location || !employment_type) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const job_id = uuidv4();
    const timestamp = new Date().toISOString();

    // ✅ Job Entry
    const newJob = {
      job_id,
      employer_id,
      job_title,
      company_name: company_name || null,
      description,
      location,
      employment_type,
      work_mode: work_mode || null,
      salary_range: salary_range || null,
      experience_required: experience_required || null,
      skills_required: skills_required || [],
      responsibilities: responsibilities || [],
      qualifications: qualifications || [],
      application_deadline: application_deadline || null,
      contact_email: contact_email || null,
      status:
        (job_status || "Open").charAt(0).toUpperCase() +
        (job_status || "Open").slice(1).toLowerCase(),
      created_at: timestamp,
      updated_at: timestamp,

      // ✅ New Fields
      edit: null,
      // closed: null,
      status_verified: "notverified",
      edit_verified: null,
      // close_verified: null,
      to_show_user: false
    };

    // ✅ Task Entry for TaskDB
    const task_id = uuidv4();
    const newTask = {
      task_id,
      category: "postnewjob",
      job_id,
      recruiter_id: employer_id,
      status: "pending",
      created_at: timestamp,
      updated_at: timestamp
    };

    // ✅ Save both Job & Task
    await Promise.all([
      ddbDocClient.send(
        new PutCommand({
          TableName: JOB_TABLE,
          Item: newJob
        })
      ),
      ddbDocClient.send(
        new PutCommand({
          TableName: TASK_TABLE,
          Item: newTask
        })
      )
    ]);

    return res.status(201).json({
      message: "Job posted successfully",
      job_id,
      job: newJob,
      task: newTask
    });

  } catch (err) {
    console.error("Job Post Error:", err);
    return res.status(500).json({ error: "Failed to post job" });
  }
};


   

export const postGovernmentJob = async (req, res) => {
  try {
    const {
      job_title,
      description,
      location,
      salary_range,
      employment_type,
      skills_required,
      experience_required,
      department_name, // e.g., UPSC, SSC, Railways
      work_mode,
      responsibilities,
      qualifications,
      application_deadline,
      contact_email,
      job_status
    } = req.body;

    // ✅ Admin ID from JWT (recommended)
    const admin_id = req.user?.admin_id || req.body.admin_id;

    // ✅ Required fields check
    if (!admin_id || !job_title || !description || !location || !employment_type || !department_name) {
      return res.status(400).json({ error: "Required fields missing (admin_id, job_title, etc.)" });
    }

    const job_id = uuidv4();
    const timestamp = new Date().toISOString();

    const newGovJob = {
      job_id,
      admin_id, // ✅ store the admin who posted this job
      job_title,
      department_name,
      description,
      location,
      employment_type,
      work_mode: work_mode || null,
      salary_range: salary_range || null,
      experience_required: experience_required || null,
      skills_required: skills_required || [],
      responsibilities: responsibilities || [],
      qualifications: qualifications || [],
      application_deadline: application_deadline || null,
      contact_email: contact_email || null,
      status: (job_status || "Open").charAt(0).toUpperCase() + (job_status || "Open").slice(1).toLowerCase(),
      created_at: timestamp,
      updated_at: timestamp,
      posted_by: "admin" // marker for clarity
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: GOV_JOB_TABLE,
        Item: newGovJob
      })
    );

    return res.status(201).json({
      message: "Government job posted successfully",
      job_id,
      job: newGovJob
    });

  } catch (err) {
    console.error("Government Job Post Error:", err);
    return res.status(500).json({ error: "Failed to post government job" });
  }
};

export const updateGovernmentJob = async (req, res) => {
  try {
    const { job_id } = req.params; // /gov-jobs/:job_id
    const admin_id = req.user?.admin_id || req.body.admin_id; // JWT recommended
    const updates = req.body; // Fields to update

    if (!job_id || !admin_id) {
      return res.status(400).json({ error: "job_id and admin_id required" });
    }

    // Build dynamic UpdateExpression
    let updateExp = "SET updated_at = :updated_at";
    const exprAttrValues = { ":updated_at": new Date().toISOString() };
    const exprAttrNames = {};

    const updatableFields = [
      "job_title", "description", "location", "salary_range", "employment_type",
      "skills_required", "experience_required", "department_name",
      "work_mode", "responsibilities", "qualifications",
      "application_deadline", "contact_email", "status"
    ];

    updatableFields.forEach((field) => {
      if (updates[field] !== undefined) {
        const key = `#${field}`;
        const val = `:${field}`;
        updateExp += `, ${key} = ${val}`;
        exprAttrNames[key] = field;
        exprAttrValues[val] = updates[field];
      }
    });

    if (Object.keys(exprAttrValues).length === 1) { // only updated_at
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: GOV_JOB_TABLE,
        Key: { job_id },
        UpdateExpression: updateExp,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ConditionExpression: "admin_id = :admin_id", // ✅ ensure only posting admin can update
        ExpressionAttributeValues: { ...exprAttrValues, ":admin_id": admin_id },
        ReturnValues: "ALL_NEW"
      })
    );

    return res.status(200).json({ message: "Government job updated successfully" });
  } catch (err) {
    console.error("Government Job Update Error:", err);
    return res.status(500).json({ error: "Failed to update government job" });
  }
};



export const updateJob = async (req, res) => {
  try {
    const { job_id } = req.params; // /jobs/:job_id
    const employer_id = req.user?.employer_id || req.body.employer_id;
    const updates = req.body;

    if (!job_id || !employer_id) {
      return res.status(400).json({ error: "job_id and employer_id required" });
    }

    let updateExp = "SET updated_at = :updated_at";
    const exprAttrValues = {
      ":updated_at": new Date().toISOString(),

      // ✅ Mandatory automatic updates
      ":edit": "pending",
      ":edit_verified": "notverified",
      ":to_show_user": false
    };
    const exprAttrNames = {
      "#edit": "edit",
      "#edit_verified": "edit_verified",
      "#to_show_user": "to_show_user"
    };

    // ✅ Always force these fields to update
    updateExp += ", #edit = :edit, #edit_verified = :edit_verified, #to_show_user = :to_show_user";

    // ✅ Allow normal editable fields
    const updatableFields = [
      "job_title", "description", "location", "salary_range", "employment_type",
      "skills_required", "experience_required", "company_name",
      "work_mode", "responsibilities", "qualifications",
      "application_deadline", "contact_email", "status"
    ];

    updatableFields.forEach((field) => {
      if (updates[field] !== undefined) {
        const key = `#${field}`;
        const val = `:${field}`;
        updateExp += `, ${key} = ${val}`;
        exprAttrNames[key] = field;
        exprAttrValues[val] = updates[field];
      }
    });

    if (Object.keys(exprAttrValues).length <= 4) { // 1 for updated_at + 3 mandatory updates
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    // ✅ Update Job record
    const result = await ddbDocClient.send(
      new UpdateCommand({
        TableName: JOB_TABLE,
        Key: { job_id },
        UpdateExpression: updateExp,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: { ...exprAttrValues, ":employer_id": employer_id },
        ConditionExpression: "employer_id = :employer_id",
        ReturnValues: "ALL_NEW"
      })
    );

    // ✅ Create Task entry for editjob
    const task_id = uuidv4();
    const timestamp = new Date().toISOString();
    const newTask = {
      task_id,
      category: "editjob",
      job_id,
      recruiter_id: employer_id,
      status: "pending",
      created_at: timestamp,
      updated_at: timestamp
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TASK_TABLE,
        Item: newTask
      })
    );

    return res.status(200).json({
      message: "Job updated successfully",
      job: result.Attributes,
      task: newTask
    });
  } catch (err) {
    console.error("Job Update Error:", err);
    return res.status(500).json({ error: "Failed to update job" });
  }
};