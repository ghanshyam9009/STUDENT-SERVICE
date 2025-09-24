import { PutCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const JOB_TABLE = process.env.JOB_TABLE;

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

    // Employer/Recruiter ID from JWT middleware (recommended)
    const employer_id = req.user?.employer_id || req.body.employer_id;

    if (!employer_id || !job_title || !description || !location || !employment_type) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const job_id = uuidv4();
    const timestamp = new Date().toISOString();

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
      status: (job_status || "Open").charAt(0).toUpperCase() + (job_status || "Open").slice(1).toLowerCase(), // normalize status
      created_at: timestamp,
      updated_at: timestamp
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: JOB_TABLE,
        Item: newJob
      })
    );

    return res.status(201).json({
      message: "Job posted successfully",
      job_id,
      job: newJob
    });

  } catch (err) {
    console.error("Job Post Error:", err);
    return res.status(500).json({ error: "Failed to post job" });
  }
};

   