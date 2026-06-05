


import {
  PutCommand,
  ScanCommand,
  GetCommand
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

const normalizeId = (id) => {
  if (id == null || id === "") return null;
  return String(id).trim();
};

// application.student_id maps to Student.user_id
const fetchStudentByUserId = async (studentId) => {
  const idStr = normalizeId(studentId);
  if (!idStr) return null;

  const tryFetch = async (value) => {
    const result = await ddbDocClient.send(
      new ScanCommand({
        TableName: STUDENT_TABLE,
        FilterExpression: "user_id = :uid",
        ExpressionAttributeValues: { ":uid": value },
      })
    );
    return result.Items?.[0] || null;
  };

  let student = await tryFetch(idStr);
  if (student) return student;

  const idNum = Number(idStr);
  if (!Number.isNaN(idNum)) {
    student = await tryFetch(idNum);
    if (student) return student;
  }

  return null;
};

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

    // application.student_id = Student.user_id
    let studentData = await fetchStudentByUserId(student_id);

    if (!studentData && student_email) {
      const studentResult = await ddbDocClient.send(
        new ScanCommand({
          TableName: STUDENT_TABLE,
          FilterExpression: "email = :email",
          ExpressionAttributeValues: {
            ":email": student_email,
          },
        })
      );
      studentData = studentResult.Items?.[0] || null;
    }

    if (!studentData) {
      return res.status(404).json({ error: "Student not found" });
    }

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
      student_phone: studentData.phone_number || studentData.phone || null,
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

    const studentData = await fetchStudentByUserId(student_id);

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
      status: "Approved",
      status_verified: "verified",   // ✔
      to_show_user: false,           // ✔
      to_show_recruiter: true,      // ✔
      created_at: timestamp,
      updated_at: timestamp,
      student_email: studentData?.email ?? null,
      student_name: studentData?.full_name || studentData?.name || null,
      student_phone: studentData?.phone_number || studentData?.phone || null,
      student_department: studentData?.department ?? null,
      student_university: studentData?.university ?? null,
      student_cgpa: studentData?.cgpa ?? null,
      student_skills: studentData?.skills ?? null,
      student_profile: studentData,
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

const PAGE_SIZE = 10;

const scanAllTableItems = async (tableName) => {
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

const getByKey = async (tableName, keyName, keyValue) => {
  if (!keyValue) return null;

  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { [keyName]: keyValue },
    })
  );

  return result.Item || null;
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

const buildStudentLookup = (students) => {
  const byUserId = new Map();
  const byEmail = new Map();

  for (const student of students) {
    const userId = normalizeId(student.user_id);
    if (userId) byUserId.set(userId, student);

    const email = String(student.email || "").toLowerCase().trim();
    if (email) byEmail.set(email, student);
  }

  return { byUserId, byEmail };
};

const findStudentForApplication = (application, lookup) => {
  if (!application || !lookup) return null;

  const studentId = normalizeId(application.student_id);
  if (studentId && lookup.byUserId.has(studentId)) {
    return lookup.byUserId.get(studentId);
  }

  const userId = normalizeId(application.user_id);
  if (userId && lookup.byUserId.has(userId)) {
    return lookup.byUserId.get(userId);
  }

  const email = String(application.student_email || "").toLowerCase().trim();
  if (email && lookup.byEmail.has(email)) {
    return lookup.byEmail.get(email);
  }

  return null;
};

const buildTaskLookup = (tasks) => {
  const map = new Map();

  for (const task of tasks) {
    if (!task.application_id) continue;
    const key = task.application_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  }

  return map;
};

const normalizeLocations = (location) => {
  if (!location) return [];
  if (Array.isArray(location)) return location;
  if (typeof location === "string") {
    return location.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [String(location)];
};

const matchesSearch = (entry, search) => {
  if (!search) return true;

  const q = search.toLowerCase().trim();
  const haystack = [
    entry.candidate?.name,
    entry.candidate?.email,
    entry.job?.company_name,
    entry.job?.job_title,
    entry.user_details?.full_name,
    entry.user_details?.email,
    entry.job_details?.company_name,
    entry.job_details?.job_title,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  return haystack.some((text) => text.includes(q));
};

const getPrimaryTask = (tasks = []) =>
  tasks.find((t) => t.category === "newapplication") || tasks[0] || null;

const mapTaskStatusToDisplay = (task) => {
  if (!task?.status) return "Pending";

  const s = String(task.status).toLowerCase();

  if (s === "fulfilled" || s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
};

const matchesTaskStatusFilter = (entry, statusFilter) => {
  const displayStatus = mapTaskStatusToDisplay(
    entry.task_details || entry.task
  );
  return displayStatus.toLowerCase() === statusFilter.toLowerCase();
};

const formatAppliedCandidate = (applied, user, job, application, tasks = []) => {
  const membershipType = user?.plan
    ? String(user.plan).toUpperCase()
    : user?.premium_user
      ? "PREMIUM"
      : "BASIC";

  const primaryTask = getPrimaryTask(tasks);
  const displayStatus = mapTaskStatusToDisplay(primaryTask);

  return {
    applied_id: applied.applied_id,
    applied_date: applied.created_at || applied.duration,
    user_id: applied.user_id,
    job_id: applied.job_id,
    application_id: applied.application_id,
    candidate: {
      student_id: applied.user_id,
      name: user?.full_name || application?.student_name || null,
      email: user?.email || application?.student_email || null,
      phone_number: user?.phone_number || application?.student_phone || null,
      profile_picture_url: user?.logo || null,
      membership_type: membershipType,
    },
    job: {
      job_id: job?.job_id || applied.job_id,
      job_title: job?.job_title || null,
      company_name: job?.company_name || job?.posted_company_name || null,
      locations: normalizeLocations(job?.location),
      job_category_tag: job?.job_type || job?.category || null,
    },
    application: {
      application_id: application?.application_id || applied.application_id,
      status: displayStatus,
      skills_tags: application?.student_skills || user?.skills || [],
      resume_url: application?.resume_url || null,
      applied_at: application?.created_at || applied.created_at,
    },
    task: primaryTask
      ? {
          task_id: primaryTask.task_id,
          category: primaryTask.category,
          status: primaryTask.status,
          job_id: primaryTask.job_id,
          student_id: primaryTask.student_id,
          recruiter_id: primaryTask.recruiter_id,
          created_at: primaryTask.created_at,
          updated_at: primaryTask.updated_at,
        }
      : null,
    // tasks,
    task_details: primaryTask,
    user_details: sanitizeUser(user),
    job_details: job,
    application_details: application,
  };
};

// GET /api/admin/applied-candidates
export const getAllAppliedCandidates = async (req, res) => {
  try {
    const {
      page = "1",
      search = "",
      status = "",
      role = "",
      company = "",
      job_id = "",
      date_from = "",
      date_to = "",
      sort = "newest",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const [appliedJobs, students, allTasks] = await Promise.all([
      scanAllTableItems(APPLIED_TABLE),
      scanAllTableItems(STUDENT_TABLE),
      scanAllTableItems(TASK_TABLE),
    ]);

    const studentLookup = buildStudentLookup(students);
    const taskMap = buildTaskLookup(allTasks);

    const uniqueJobIds = [...new Set(appliedJobs.map((a) => a.job_id).filter(Boolean))];
    const uniqueAppIds = [
      ...new Set(appliedJobs.map((a) => a.application_id).filter(Boolean)),
    ];

    const [jobResults, appResults] = await Promise.all([
      Promise.all(uniqueJobIds.map((id) => getByKey(JOB_TABLE, "job_id", id))),
      Promise.all(uniqueAppIds.map((id) => getByKey(APPLICATION_TABLE, "application_id", id))),
    ]);

    const jobMap = new Map(
      jobResults.filter(Boolean).map((job) => [job.job_id, job])
    );
    const appMap = new Map(
      appResults.filter(Boolean).map((app) => [app.application_id, app])
    );

    let entries = appliedJobs.map((applied) => {
      const job = jobMap.get(applied.job_id) || null;
      const application = appMap.get(applied.application_id) || null;
      const user =
        studentLookup.byUserId.get(normalizeId(applied.user_id)) ||
        findStudentForApplication(application, studentLookup) ||
        null;
      const tasks = taskMap.get(applied.application_id) || [];
      return formatAppliedCandidate(applied, user, job, application, tasks);
    });

    if (search) {
      entries = entries.filter((e) => matchesSearch(e, search));
    }

    if (status) {
      entries = entries.filter((e) => matchesTaskStatusFilter(e, status));
    }

    if (role) {
      const roleFilter = role.toLowerCase().trim();
      entries = entries.filter((e) => {
        const postedBy = String(
          e.job?.posted_by || e.job_details?.posted_by || ""
        )
          .toLowerCase()
          .trim();

        if (roleFilter === "admin") return postedBy === "admin";
        if (roleFilter === "recruiter") return postedBy === "recruiter";
        return true;
      });
    }

    if (company) {
      const companyFilter = company.toLowerCase();
      entries = entries.filter((e) =>
        (e.job?.company_name || "").toLowerCase().includes(companyFilter)
      );
    }

    if (job_id) {
      entries = entries.filter((e) => e.job_id === job_id);
    }

    if (date_from) {
      const from = new Date(date_from).getTime();
      entries = entries.filter((e) => {
        const appliedAt = new Date(e.applied_date || 0).getTime();
        return !Number.isNaN(from) && appliedAt >= from;
      });
    }

    if (date_to) {
      const to = new Date(date_to).getTime();
      entries = entries.filter((e) => {
        const appliedAt = new Date(e.applied_date || 0).getTime();
        return !Number.isNaN(to) && appliedAt <= to;
      });
    }

    entries.sort((a, b) => {
      const dateA = new Date(a.applied_date || 0).getTime();
      const dateB = new Date(b.applied_date || 0).getTime();
      return sort === "oldest" ? dateA - dateB : dateB - dateA;
    });

    const total = entries.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    const start = (pageNum - 1) * PAGE_SIZE;
    const paginated = entries.slice(start, start + PAGE_SIZE);

    const companies = [
      ...new Set(
        entries.map((e) => e.job?.company_name).filter(Boolean)
      ),
    ].sort();

    const jobs = [
      ...new Map(
        entries
          .filter((e) => e.job_id && e.job?.job_title)
          .map((e) => [e.job_id, { job_id: e.job_id, job_title: e.job.job_title }])
      ).values(),
    ];

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: PAGE_SIZE,
      total_pages: totalPages,
      showing: paginated.length,
      filters: {
        companies,
        jobs,
        statuses: ["Approved", "Pending", "Rejected"],
      },
      data: paginated,
    });
  } catch (err) {
    console.error("Get Applied Candidates Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch applied candidates",
    });
  }
};