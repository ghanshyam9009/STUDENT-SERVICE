import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

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

// -----------------------------------
// Middleware
// -----------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// -----------------------------------
// DynamoDB Setup
// -----------------------------------
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
export const ddb = DynamoDBDocumentClient.from(client);

const CONTACT_TABLE = "contact_form";
const QUERY_TABLE = "query_form";





app.post("/contact", async (req, res) => {
  try {
    const { name, email, message, phone } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email & message required" });
    }

    const item = {
      contact_id: uuidv4(),
      name,
      email,
      phone: phone || null,
      message,
      created_at: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: CONTACT_TABLE,
        Item: item,
      })
    );

    return res.json({ message: "Contact form submitted", data: item });
  } catch (err) {
    console.error("Contact Form Error:", err);
    return res.status(500).json({ error: "Failed to submit contact form" });
  }
});


app.get("/contact", async (req, res) => {
  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: CONTACT_TABLE,
      })
    );

    return res.json({
      count: result.Items?.length || 0,
      contacts: result.Items || [],
    });
  } catch (err) {
    console.error("Fetch Contact Error:", err);
    return res.status(500).json({ error: "Failed to fetch contacts" });
  }
});


app.post("/query", async (req, res) => {
  try {
    const { name, email, question } = req.body;

    if (!name || !email || !question) {
      return res.status(400).json({ error: "Name, email & question required" });
    }

    const item = {
      query_id: uuidv4(),
      name,
      email,
      question,
      created_at: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: QUERY_TABLE,
        Item: item,
      })
    );

    return res.json({ message: "Query submitted", data: item });
  } catch (err) {
    console.error("Query Form Error:", err);
    return res.status(500).json({ error: "Failed to submit query" });
  }
});


app.get("/query", async (req, res) => {
  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: QUERY_TABLE,
      })
    );

    return res.json({
      count: result.Items?.length || 0,
      queries: result.Items || [],
    });
  } catch (err) {
    console.error("Fetch Query Error:", err);
    return res.status(500).json({ error: "Failed to fetch queries" });
  }
});

// -----------------------------------
// Other Routes
// -----------------------------------
app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/Recruiter", RecruiterRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/application", applicationRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api", paymentroutes);
app.use("/api/premium", premiumroutes);

// -----------------------------------
// Start Server
// -----------------------------------
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