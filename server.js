import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import studentRoutes from "./routes/studentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import RecruiterRoutes from "./routes/RecruiterRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import passwordRoutes from "./routes/passwordRoutes.js";
import paymentroutes from "./routes/paymentroutes.js";
import premiumroutes from "./routes/premiumRoutes.js";

dotenv.config();

const app = express();

// ✅ Enable CORS for all origins and methods
app.use(cors({
  origin: ['http://localhost:5173'], // <-- Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // <-- Allow common HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // <-- Allow headers commonly used in APIs
}));

app.use(express.json());

app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/Recruiter", RecruiterRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/application", applicationRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api", paymentroutes);
app.use("/api/premium", premiumroutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`All services running on port ${PORT}`));
