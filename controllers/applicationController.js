


import {
  PutCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";



import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({});
const ddbDoc = DynamoDBDocumentClient.from(ddbClient);


dotenv.config();

const APPLICATION_TABLE = process.env.APPLICATION_TABLE;
const JOB_TABLE         = process.env.JOB_TABLE;
const APPLIED_TABLE     = process.env.APPLIED_TABLE;
const USER_TABLE        = process.env.USERS_TABLE;
const TASK_TABLE        = process.env.TASK_TABLE;
const GOV_JOB_APPLICATION_TABLE = process.env.GOV_JOB_TABLE
const JOB_GSI_NAME = "job_id-index"; 
const STUDENT_TABLE = process.env.USERS_TABLE;    
// -----------------------------------------
// ✅ Apply for a Job
// -----------------------------------------
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

//     const timestamp = new Date().toISOString();
//     const application_id = uuidv4();
//     const applied_id     = uuidv4();
//     const task_id        = uuidv4();

//     // ✅ 1. Application record with new fields
//     const newApplication = {
//       application_id,       // PK
//       job_id,
//       student_id,
//       employer_id: job.employer_id,
//       resume_url: resume_url || null,
//       cover_letter: cover_letter || null,
//       status: "Pending",
//       status_verified: "notverified", // new
//       to_show_recruiter: false,       // new
//       to_show_user: false,            // new
//       created_at: timestamp,
//       updated_at: timestamp
//     };

//     await ddbDocClient.send(
//       new PutCommand({
//         TableName: APPLICATION_TABLE,
//         Item: newApplication
//       })
//     );

//     // ✅ 2. Applied job entry
//     const appliedItem = {
//       applied_id,           // PK
//       job_id,
//       user_id: student_id,
//       application_id,
//       duration: timestamp,
//       created_at: timestamp
//     };
//     await ddbDocClient.send(
//       new PutCommand({
//         TableName: APPLIED_TABLE,
//         Item: appliedItem
//       })
//     );

//     // ✅ 3. Create a task entry for workflow
//     const taskItem = {
//       task_id,             // PK
//       category: "newapplication",
//       job_id,
//       recruiter_id: job.employer_id,
//       application_id,
//       student_id,
//       status: "pending",
//       created_at: timestamp,
//       updated_at: timestamp
//     };

//     await ddbDocClient.send(
//       new PutCommand({
//         TableName: TASK_TABLE,
//         Item: taskItem
//       })
//     );

//     return res.status(201).json({
//       message: "Application submitted successfully",
//       application_id,
//       application: newApplication,
//       applied_entry: appliedItem,
//       task_entry: taskItem
//     });

//   } catch (err) {
//     console.error("Job Application Error:", err);
//     return res.status(500).json({ error: "Failed to apply for job" });
//   }
// };

export const applyForJob = async (req, res) => {
  try {
    const { job_id } = req.params;
    const { resume_url, cover_letter, student_email } = req.body;

    const student_id = req.user?.student_id || req.body.student_id;

    if (!student_id || !job_id) {
      return res.status(400).json({ error: "student_id and job_id are required" });
    }

    if (!student_email) {
      return res.status(400).json({ error: "student_email is required" });
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

    // 🔹 Fetch Student Details from Student Table using email
    const studentResult = await ddbDocClient.send(
      new ScanCommand({
        TableName: STUDENT_TABLE,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": student_email
        }
      })
    );

    if (!studentResult.Items || studentResult.Items.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const studentData = studentResult.Items[0];

    const timestamp = new Date().toISOString();
    const application_id = uuidv4();
    const applied_id = uuidv4();
    const task_id = uuidv4();

    // --------------------------------------
    // ✅ MERGE STUDENT DATA INTO APPLICATION
    // --------------------------------------
    const newApplication = {
      application_id,
      job_id,
      student_id,
      employer_id: job.employer_id,

      resume_url: resume_url || null,
      cover_letter: cover_letter || null,

      status: "Pending",
      status_verified: "notverified",
      to_show_recruiter: false,
      to_show_user: false,

      created_at: timestamp,
      updated_at: timestamp,

      // 🔥 EXTRA Student Info
      student_email: studentData.email,
      student_name: studentData.full_name || studentData.name,
      student_phone: studentData.phone || null,
      student_department: studentData.department || null,
      student_university: studentData.university || null,
      student_cgpa: studentData.cgpa || null,
      student_skills: studentData.skills || [],
      student_profile: studentData // if you want ALL fields stored
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: APPLICATION_TABLE,
        Item: newApplication
      })
    );

    // ------------------------------------------
    // Applied Job Entry
    // ------------------------------------------
    const appliedItem = {
      applied_id,
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

    // ------------------------------------------
    // Task Entry
    // ------------------------------------------
    const taskItem = {
      task_id,
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





export const applyForGovernmentJob = async (req, res) => {
  try {
    const { job_id } = req.params;
    const { resume_url, cover_letter } = req.body;
    const student_id = req.user?.student_id || req.body.student_id;

    if (!student_id || !job_id) {
      return res.status(400).json({ error: "student_id and job_id are required" });
    }

    // 🔹 Check if govt job exists
    const jobResult = await ddbDocClient.send(
      new ScanCommand({
        TableName: GOV_JOB_APPLICATION_TABLE,
        FilterExpression: "job_id = :job_id",
        ExpressionAttributeValues: { ":job_id": job_id }
      })
    );

    if (!jobResult.Items || jobResult.Items.length === 0) {
      return res.status(404).json({ error: "Government job not found" });
    }
    const job = jobResult.Items[0];

    // 🔹 Prevent duplicate government application
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

    if (existing.Items?.length > 0) {
      return res.status(400).json({ error: "You already applied for this govt job" });
    }

    const timestamp = new Date().toISOString();
    const application_id = uuidv4();
    const applied_id     = uuidv4();

    // 🔹 Application item
    const newApplication = {
      application_id,
      job_id,
      student_id,
      resume_url: resume_url || null,
      cover_letter: cover_letter || null,
      status: "Pending",
      status_verified: "not_verified",  // ✔
      to_show_user: false,          // ✔
      to_show_recruiter: false,     // ✔
      created_at: timestamp,
      updated_at: timestamp
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: APPLICATION_TABLE,
        Item: newApplication
      })
    );

    // 🔹 Record that student applied
    const appliedItem = {
      applied_id,
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

    return res.status(201).json({
      message: "Government job application submitted",
      application_id,
      application: newApplication,
      applied_entry: appliedItem
    });

  } catch (err) {
    console.error("Gov Job Application Error:", err);
    return res.status(500).json({ error: "Failed to apply for government job" });
  }
};





export const applyForAdminJob = async (req, res) => {
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

    if (existing.Items?.length > 0) {
      return res.status(400).json({ error: "You already applied for this job" });
    }

    const timestamp = new Date().toISOString();
    const application_id = uuidv4();
    const applied_id     = uuidv4();

    // 🔹 Application record (NO task, VERIFIED, hidden)
    const newApplication = {
      application_id,
      job_id,
      student_id,
      employer_id: job.employer_id || null,
      resume_url: resume_url || null,
      cover_letter: cover_letter || null,
      status: "Pending",
      status_verified: "verified",   // ✔
      to_show_user: false,           // ✔
      to_show_recruiter: false,      // ✔
      created_at: timestamp,
      updated_at: timestamp
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: APPLICATION_TABLE,
        Item: newApplication
      })
    );

    // 🔹 Applied record
    const appliedItem = {
      applied_id,
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

    return res.status(201).json({
      message: "Admin job application submitted",
      application_id,
      application: newApplication,
      applied_entry: appliedItem
    });

  } catch (err) {
    console.error("Admin Job Application Error:", err);
    return res.status(500).json({ error: "Failed to apply for admin job" });
  }
};




export const applications = async (req, res) => {
  try {
    const job_id = req.params.job_id;  // ✅ FIXED

    if (!job_id) {
      return res.status(400).json({ error: "job_id is required" });
    }

    const result = await ddbDoc.send(
      new QueryCommand({
        TableName: APPLICATION_TABLE,
        IndexName: JOB_GSI_NAME,
        KeyConditionExpression: "job_id = :jid",
        ExpressionAttributeValues: {
          ":jid": job_id,
        },
        ScanIndexForward: false
      })
    );

    return res.json({
      count: result.Items?.length || 0,
      job_id,
      applications: result.Items || []
    });

  } catch (err) {
    console.error("Error fetching applications:", err);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
};




export const getApplicationsByJobId = async (req, res) => {
  const jobId = req.query.job_id;

  if (!jobId) {
    return res.status(400).json({ message: "job_id is required" });
  }

  const params = {
    TableName: "application",
    IndexName: "job_id-index",
    KeyConditionExpression: "job_id = :jobId",
    ExpressionAttributeValues: {
      ":jobId": jobId
    }
  };

  try {
    const data = await docClient.send(new QueryCommand(params));

    res.json({
      job_id: jobId,
      count: data.Count,
      applications: data.Items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};