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
      employment_type, // e.g., Full-time, Part-time, Internship
      skills,          // array of strings
      experience_level // e.g., Fresher, Mid, Senior
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
      description,
      location,
      salary_range: salary_range || null,
      employment_type,
      skills: skills || [],
      experience_level: experience_level || null,
      status: "Open", // default status
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
   