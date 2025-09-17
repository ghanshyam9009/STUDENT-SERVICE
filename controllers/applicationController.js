import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const APPLICATION_TABLE = process.env.APPLICATION_TABLE;
const JOB_TABLE = process.env.JOB_TABLE; // To verify the job exists

// -----------------------------------------
// ✅ Apply for a Job
// -----------------------------------------
export const applyForJob = async (req, res) => {
  try {
    const { job_id } = req.params;
    const { resume_url, cover_letter } = req.body;
    const student_id = req.user?.student_id || req.body.student_id;

    if (!student_id || !job_id) {
      return res.status(400).json({ error: "student_id and job_id are required" });
    }

    // 🔹 Check if job exists
    const jobResult = await ddbDocClient.send(
      new ScanCommand({
        TableName: JOB_TABLE,
        FilterExpression: "job_id = :job_id",
        ExpressionAttributeValues: { ":job_id": job_id }
      })
    );

    if (!jobResult.Items || jobResult.Items.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = jobResult.Items[0];

    // 🔹 Prevent duplicate application by the same student
    const existing = await ddbDocClient.send(
      new ScanCommand({
        TableName: APPLICATION_TABLE,
        FilterExpression: "job_id = :job_id AND student_id = :student_id",
        ExpressionAttributeValues: {
          ":job_id": job_id,
          ":student_id": student_id
        }
      })
    );

    if (existing.Items && existing.Items.length > 0) {
      return res.status(400).json({ error: "You have already applied for this job" });
    }

    const application_id = uuidv4();
    const timestamp = new Date().toISOString();

    const newApplication = {
      application_id,
      job_id,
      employer_id: job.employer_id,
      student_id,
      resume_url: resume_url || null,
      cover_letter: cover_letter || null,
      status: "Pending", // default status
      created_at: timestamp,
      updated_at: timestamp
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: APPLICATION_TABLE,
        Item: newApplication
      })
    );

    return res.status(201).json({
      message: "Application submitted successfully",
      application_id,
      application: newApplication
    });
  } catch (err) {
    console.error("Job Application Error:", err);
    return res.status(500).json({ error: "Failed to apply for job" });
  }
};
