import express from "express";
import dotenv from "dotenv";
import serverless from "serverless-http";

import studentRoutes from "./routes/studentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import RecruiterRoutes from "./routes/RecruiterRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Your routes remain the same
app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/Recruiter", RecruiterRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/application", applicationRoutes);

// ❌ Remove app.listen()
// ✅ Export a Lambda handler instead
export const handler = serverless(app);
