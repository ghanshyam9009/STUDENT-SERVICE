// import {
//   PutCommand,
//   ScanCommand,
//   UpdateCommand
// } from "@aws-sdk/lib-dynamodb";
// import ddbDocClient from "../config/db.js";
// import dotenv from "dotenv";
// import { v4 as uuidv4 } from "uuid";

// dotenv.config();

// const APPLICATION_TABLE = process.env.APPLICATION_TABLE;
// const JOB_TABLE         = process.env.JOB_TABLE;        // to verify job exists
// const APPLIED_TABLE     = process.env.APPLIED_TABLE;    // 🔹 new appliedjob table
// const USER_TABLE     = process.env.USERS_TABLE;    // 🔹 student table to increment count

// // -----------------------------------------
// // ✅ Apply for a Job
// // -----------------------------------------
// export const applyForJob = async (req, res) => {
//   try {
//     const { job_id } = req.params;
//     const { resume_url, cover_letter } = req.body;
//     const student_id = req.user?.student_id || req.body.student_id;

//     if (!student_id || !job_id) {
//       return res.status(400).json({ error: "student_id and job_id are required" });
//     }

//     // 🔹 Check if job exists
//     const jobResult = await ddbDocClient.send(
//       new ScanCommand({
//         TableName: JOB_TABLE,
//         FilterExpression: "job_id = :job_id",
//         ExpressionAttributeValues: { ":job_id": job_id }
//       })
//     );

//     if (!jobResult.Items || jobResult.Items.length === 0) {
//       return res.status(404).json({ error: "Job not found" });
//     }

//     const job = jobResult.Items[0];

//     // 🔹 Prevent duplicate application
//     const existing = await ddbDocClient.send(
//       new ScanCommand({
//         TableName: APPLICATION_TABLE,
//         FilterExpression: "job_id = :job_id AND student_id = :student_id",
//         ExpressionAttributeValues: {
//           ":job_id": job_id,
//           ":student_id": student_id
//         }
//       })
//     );

//     if (existing.Items && existing.Items.length > 0) {
//       return res.status(400).json({ error: "You have already applied for this job" });
//     }

//     const application_id = uuidv4();
//     const applied_id     = uuidv4(); // entry ID for appliedjob table
//     const timestamp      = new Date().toISOString();

//     const newApplication = {
//       application_id,
//       job_id,
//       employer_id: job.employer_id,
//       student_id,
//       resume_url: resume_url || null,
//       cover_letter: cover_letter || null,
//       status: "Pending",
//       created_at: timestamp,
//       updated_at: timestamp
//     };

//     // ✅ 1. Create record in APPLICATION_TABLE
//     await ddbDocClient.send(
//       new PutCommand({
//         TableName: APPLICATION_TABLE,
//         Item: newApplication
//       })
//     );

//     // ✅ 2. Create entry in APPLIED_TABLE
//     const appliedItem = {
//       applied_id,
//       job_id,
//       user_id: student_id,
//       application_id,
//       duration: timestamp,      // you can store duration or applied date
//       created_at: timestamp
//     };

//     await ddbDocClient.send(
//       new PutCommand({
//         TableName: APPLIED_TABLE,
//         Item: appliedItem
//       })
//     );

//     // ✅ 3. Increment applied job count in STUDENT_TABLE
//     await ddbDocClient.send(
//       new UpdateCommand({
//         TableName: USER_TABLE,
//         Key: { student_id },                 // assumes student_id is the PK
//         UpdateExpression:
//           "SET applied_jobs_count = if_not_exists(applied_jobs_count, :zero) + :inc",
//         ExpressionAttributeValues: {
//           ":inc": 1,
//           ":zero": 0
//         }
//       })
//     );

//     return res.status(201).json({
//       message: "Application submitted successfully",
//       application_id,
//       application: newApplication,
//       applied_entry: appliedItem
//     });

//   } catch (err) {
//     console.error("Job Application Error:", err);
//     return res.status(500).json({ error: "Failed to apply for job" });
//   }
// };


import {
  PutCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const APPLICATION_TABLE = process.env.APPLICATION_TABLE;
const JOB_TABLE         = process.env.JOB_TABLE;
const APPLIED_TABLE     = process.env.APPLIED_TABLE;
const USER_TABLE        = process.env.USERS_TABLE;
const TASK_TABLE        = process.env.TASK_TABLE;

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

    // 🔹 Prevent duplicate application
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

    const timestamp = new Date().toISOString();
    const application_id = uuidv4();
    const applied_id     = uuidv4();
    const task_id        = uuidv4();

    // ✅ 1. Application record with new fields
    const newApplication = {
      application_id,       // PK
      job_id,
      student_id,
      employer_id: job.employer_id,
      resume_url: resume_url || null,
      cover_letter: cover_letter || null,
      status: "Pending",
      status_verified: "notverified", // new
      to_show_recruiter: false,       // new
      to_show_user: false,            // new
      created_at: timestamp,
      updated_at: timestamp
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: APPLICATION_TABLE,
        Item: newApplication
      })
    );

    // ✅ 2. Applied job entry
    const appliedItem = {
      applied_id,           // PK
      job_id,
      user_id: student_id,
      application_id,
      duration: timestamp,
      created_at: timestamp
    };
    await ddbDocClient.send(
      new PutCommand({
        TableName: APPLIED_TABLE,
        Item: appliedItem
      })
    );

    // ✅ 3. Create a task entry for workflow
    const taskItem = {
      task_id,             // PK
      category: "newapplication",
      job_id,
      recruiter_id: job.employer_id,
      application_id,
      student_id,
      status: "pending",
      created_at: timestamp,
      updated_at: timestamp
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TASK_TABLE,
        Item: taskItem
      })
    );

    return res.status(201).json({
      message: "Application submitted successfully",
      application_id,
      application: newApplication,
      applied_entry: appliedItem,
      task_entry: taskItem
    });

  } catch (err) {
    console.error("Job Application Error:", err);
    return res.status(500).json({ error: "Failed to apply for job" });
  }
};
