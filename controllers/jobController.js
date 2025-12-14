

import ddbDocClient from "../config/db.js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import {
  PutCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { sendEmail } from "../utils/mailer.js";  // ✅ import mailer

dotenv.config();

const JOB_TABLE = process.env.JOB_TABLE;
const GOV_JOB_TABLE = process.env.GOV_JOB_TABLE;
const TASK_TABLE = process.env.TASK_TABLE;
const USERS_TABLE = process.env.USERS_TABLE; // ✅ students table
const EMPLOYER_TABLE = process.env.EMPLOYER_TABLE

// -----------------------------------------
// ✅ Helper: Send job notification to all students
// -----------------------------------------
const notifyAllStudents = async (subject, message, htmlContent) => {
  try {
    const studentsData = await ddbDocClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        ProjectionExpression: "email", // fetch only emails
      })
    );

    const students = studentsData.Items || [];
    if (students.length === 0) {
      console.log("No students found to send emails.");
      return;
    }

    // Send emails in parallel (in batches for performance)
    const emailPromises = students.map((student) =>
      sendEmail({
        to: student.email,
        subject,
        text: message,
        html: htmlContent,
      })
    );

    await Promise.allSettled(emailPromises);
    console.log(`✅ Job notification emails sent to ${students.length} students`);
  } catch (err) {
    console.error("Error sending job notifications:", err);
  }
};

// -----------------------------------------
// ✅ Post a Normal Job
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

    const employer_id = req.user?.employer_id || req.body.employer_id;

    if (!employer_id || !job_title || !description || !location || !employment_type) {
      return res.status(400).json({ error: "Required fields missing" });
    }


    const employerResult = await ddbDocClient.send(
      new ScanCommand({
        TableName: EMPLOYER_TABLE,
        FilterExpression: "employer_id = :eid",
        ExpressionAttributeValues: {
          ":eid": employer_id
        }
      })
    );

    if (!employerResult.Items || employerResult.Items.length === 0) {
      return res.status(404).json({ error: "Employer not found" });
    }

    const employer = employerResult.Items[0];

    // ❌ If admin has NOT approved recruiter → stop posting
    if (!employer.hasadminapproved) {
      return res.status(403).json({
        error: "Your recruiter account is not approved by admin. You cannot post jobs."
      });
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
      status:
        (job_status || "Open").charAt(0).toUpperCase() +
        (job_status || "Open").slice(1).toLowerCase(),
      created_at: timestamp,
      updated_at: timestamp,
      edit: null,
      status_verified: "notverified",
      edit_verified: null,
      to_show_user: false,
      is_premium: false,
      job_type : "PRIVATE",
      posted_by : "RECRUITER"
    };

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

    // ✅ Send email notification to all students
    const subject = `📢 New Job Posted: ${job_title}`;
    const textMsg = `A new job titled "${job_title}" has been posted by ${company_name || "a company"} at ${location}.`;
    const htmlMsg = `
      <h2>New Job Alert 🚀</h2>
      <p><b>Job Title:</b> ${job_title}</p>
      <p><b>Company:</b> ${company_name || "Not specified"}</p>
      <p><b>Location:</b> ${location}</p>
      <p><b>Employment Type:</b> ${employment_type}</p>
      <p><b>Deadline:</b> ${application_deadline || "Not specified"}</p>
      <p>Log in now to apply!</p>
    `;

    notifyAllStudents(subject, textMsg, htmlMsg);

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
      department_name,
      work_mode,
      responsibilities,
      qualifications,
      application_deadline,
      contact_email,
      job_status
    } = req.body;

    const admin_id = req.user?.admin_id || req.body.admin_id;

    if (!admin_id || !job_title || !description || !location || !employment_type || !department_name) {
      return res.status(400).json({ error: "Required fields missing (admin_id, job_title, etc.)" });
    }

    const job_id = uuidv4();
    const timestamp = new Date().toISOString();

    const newGovJob = {
      job_id,
      admin_id,
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
      status:
        (job_status || "Open").charAt(0).toUpperCase() +
        (job_status || "Open").slice(1).toLowerCase(),
      created_at: timestamp,
      updated_at: timestamp,
      job_type : "GOVERNMENT",
      posted_by : "ADMIN",

      // ✅ Visible & verified by default
      to_show_user: true,
      status_verified: "verified",
      edit_verified: "verified",
      is_premium: false,
      edit: null
    };

    await Promise.all([
      ddbDocClient.send(
        new PutCommand({
          TableName: GOV_JOB_TABLE,
          Item: newGovJob
        })
      ),
      ddbDocClient.send(
        new PutCommand({
          TableName: JOB_TABLE,
          Item: newGovJob
        })
      )
    ]);

    // ✅ Notify all students
    const subject = `🏛️ New Government Job Posted: ${job_title}`;
    const textMsg = `A new government job in ${department_name} titled "${job_title}" is now open at ${location}.`;
    const htmlMsg = `
      <h2>New Government Job Alert 🏛️</h2>
      <p><b>Job Title:</b> ${job_title}</p>
      <p><b>Department:</b> ${department_name}</p>
      <p><b>Location:</b> ${location}</p>
      <p><b>Employment Type:</b> ${employment_type}</p>
      <p><b>Deadline:</b> ${application_deadline || "Not specified"}</p>
      <p>Visit the portal to apply now.</p>
    `;

    notifyAllStudents(subject, textMsg, htmlMsg);

    return res.status(201).json({
      message: "Government job posted successfully (visible by default)",
      job_id,
      job: newGovJob
    });

  } catch (err) {
    console.error("Government Job Post Error:", err);
    return res.status(500).json({ error: "Failed to post government job" });
  }
};


export const postJobByAdmin = async (req, res) => {
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

    const admin_id = req.user?.admin_id || req.body.admin_id;

    if (!admin_id || !job_title || !description || !location || !employment_type) {
      return res.status(400).json({ error: "Required fields missing (admin_id, job_title, etc.)" });
    }

    const job_id = uuidv4();
    const timestamp = new Date().toISOString();

    const newAdminJob = {
      job_id,
      admin_id,
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

      // ✅ All permissions/flags enabled by default
      to_show_user: true,
      status_verified: "verified",
      edit_verified: "verified",
      is_premium: false,
      job_type : "PRIVATE",
      posted_by : "ADMIN",
      edit: null
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: JOB_TABLE,
        Item: newAdminJob
      })
    );

    // ✅ Notify all students
    const subject = `📢 New Job Posted by Admin: ${job_title}`;
    const textMsg = `A new job titled "${job_title}" has been posted by ${company_name || "the admin"} at ${location}.`;
    const htmlMsg = `
      <h2>New Job Alert 🚀</h2>
      <p><b>Job Title:</b> ${job_title}</p>
      <p><b>Company:</b> ${company_name || "Not specified"}</p>
      <p><b>Location:</b> ${location}</p>
      <p><b>Employment Type:</b> ${employment_type}</p>
      <p><b>Deadline:</b> ${application_deadline || "Not specified"}</p>
      <p>Log in now to apply!</p>
    `;

    notifyAllStudents(subject, textMsg, htmlMsg);

    return res.status(201).json({
      message: "Job posted successfully by admin (visible & verified)",
      job_id,
      job: newAdminJob
    });

  } catch (err) {
    console.error("Admin Job Post Error:", err);
    return res.status(500).json({ error: "Failed to post job by admin" });
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



export const updateAdminJob = async (req, res) => {
  try {
    const { job_id } = req.params; // /admin-jobs/:job_id
    const admin_id = req.user?.admin_id || req.body.admin_id;
    const updates = req.body; // Fields to update

    if (!job_id || !admin_id) {
      return res.status(400).json({ error: "job_id and admin_id required" });
    }

    // Build dynamic update expression
    let updateExp = "SET updated_at = :updated_at";
    const exprAttrValues = { ":updated_at": new Date().toISOString(), ":admin_id": admin_id };
    const exprAttrNames = {};

    // Allowed updatable fields
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

    // If only updated_at is being set
    if (Object.keys(exprAttrValues).length === 2) { // only updated_at and admin_id
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    // Update the job in JOB_TABLE
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: JOB_TABLE,
        Key: { job_id },
        UpdateExpression: updateExp,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ConditionExpression: "admin_id = :admin_id", // ✅ ensures only job's admin can update
        ReturnValues: "ALL_NEW"
      })
    );

    return res.status(200).json({ message: "Admin job updated successfully" });

  } catch (err) {
    console.error("Admin Job Update Error:", err);
    if (err.name === "ConditionalCheckFailedException") {
      return res.status(403).json({ error: "Unauthorized: Admin mismatch" });
    }
    return res.status(500).json({ error: "Failed to update admin job" });
  }
};




export const markJobPremium = async (req, res) => {
  try {
    const { job_id, is_premium, category } = req.body;

    if (!job_id || typeof is_premium !== "boolean" || !category) {
      return res.status(400).json({ error: "job_id, is_premium (boolean), and category are required" });
    }

    let tableName;

    if (category === "job") {
      tableName = JOB_TABLE;
    } else if (category === "government") {
      tableName = GOV_JOB_TABLE;
    } else {
      return res.status(400).json({ error: "Invalid category. Must be 'job' or 'government'." });
    }

    const updateCommand = new UpdateCommand({
      TableName: tableName,
      Key: { job_id },
      UpdateExpression: "SET premium_job = :isPremium",
      ExpressionAttributeValues: {
        ":isPremium": is_premium,
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await ddbDocClient.send(updateCommand);

    return res.status(200).json({
      message: `Job in category '${category}' ${is_premium ? "marked" : "unmarked"} as premium successfully.`,
      job: result.Attributes,
    });
  } catch (error) {
    console.error("Error updating premium_job:", error);
    return res.status(500).json({ error: "Failed to update premium status for job" });
  }
};





export const closeGovernmentJob = async (req, res) => {
  try {
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: "job_id is required" });
    }

    const timestamp = new Date().toISOString();

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: GOV_JOB_TABLE,
        Key: { job_id },
        UpdateExpression:
          "set #status = :closed, to_show_user = :hide, updated_at = :updated_at",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":closed": "Closed",
          ":hide": false,
          ":updated_at": timestamp
        }
      })
    );

    return res.status(200).json({
      message: "Government job closed & hidden successfully",
      job_id
    });
  } catch (err) {
    console.error("Close Government Job Error:", err);
    return res.status(500).json({ error: "Failed to close government job" });
  }
};



export const closeAdminJob = async (req, res) => {
  try {
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: "job_id is required" });
    }

    const timestamp = new Date().toISOString();

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: JOB_TABLE,
        Key: { job_id },
        UpdateExpression:
          "set #status = :closed, to_show_user = :hide, updated_at = :updated_at",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":closed": "Closed",
          ":hide": false,
          ":updated_at": timestamp
        }
      })
    );

    return res.status(200).json({
      message: "Admin job closed & hidden successfully",
      job_id
    });
  } catch (err) {
    console.error("Close Admin Job Error:", err);
    return res.status(500).json({ error: "Failed to close admin job" });
  }
};



export const closeRecruiterJob = async (req, res) => {
  try {
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: "job_id is required" });
    }

    const timestamp = new Date().toISOString();

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: JOB_TABLE,
        Key: { job_id },
        UpdateExpression:
          "set #status = :closed, to_show_user = :hide, updated_at = :updated_at",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":closed": "Closed",
          ":hide": false,
          ":updated_at": timestamp
        }
      })
    );

    return res.status(200).json({
      message: "job is closed by recuriter ",
      job_id
    });
  } catch (err) {
    console.error("Close Admin Job Error:", err);
    return res.status(500).json({ error: "Failed to close admin job" });
  }
};