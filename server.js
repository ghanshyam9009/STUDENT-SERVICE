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
  origin: '*', // <-- Allow all origins
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















// server {
//     listen 80;
//     listen [::]:80;

//     # For IP-based access, no domain is required
//     server_name _;

//     # optional: allow bigger requests if needed
//     client_max_body_size 50M;

//     location / {
//         proxy_pass http://127.0.0.1:4000;   # Node.js app on local port
//         proxy_http_version 1.1;
//         proxy_set_header Upgrade $http_upgrade;

//         # handle websocket connections properly
//         proxy_set_header Connection "upgrade";

//         proxy_set_header Host $host;
//         proxy_set_header X-Real-IP $remote_addr;
//         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
//         proxy_set_header X-Forwarded-Proto $scheme;
//         proxy_cache_bypass $http_upgrade;
//     }

//     # optional health check
//     # optional health check
//     location = /health {
//         return 200 'OK';
//         add_header Content-Type text/plain;
//     }
// }



// http://18.141.113.253