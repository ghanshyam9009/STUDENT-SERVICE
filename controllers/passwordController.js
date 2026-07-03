import bcrypt from "bcryptjs";
import { sendOtpEmail } from "../utils/mailer.js";
import { otpStore } from "./otpStore.js";
import ddbDocClient from "../config/db.js";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const getOtpExpiryMs = () =>
  (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10) * 60 * 1000;

// Helper to get table name based on role
const getTableByRole = (role) => {
  if (role === "recruiter") return process.env.EMPLOYER_TABLE;
  return process.env.USERS_TABLE; // default to student
};

const getPasswordResetOtpKey = (role, email) => `${role}-${email}`;

const getRegistrationOtpKey = (role, email) => `reg-${role}-${email}`;

const issueOtp = async ({ email, userName, storeKey }) => {
  const otp = generateOtp();
  const expiresAt = Date.now() + getOtpExpiryMs();
  otpStore[storeKey] = { otp, expiresAt };

  await sendOtpEmail({
    to: email,
    userName,
    otp,
  });
};

// Send OTP API
export const sendOtp = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) return res.status(400).json({ error: "Email and role are required" });

    const tableName = getTableByRole(role);

    const user = await ddbDocClient.send(new GetCommand({
      TableName: tableName,
      Key: { email },
    }));

    if (!user.Item) return res.status(404).json({ error: "User not found" });

    await issueOtp({
      email,
      userName: user.Item.full_name || user.Item.name || "User",
      storeKey: getPasswordResetOtpKey(role, email),
    });

    return res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Send OTP error:", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};

// Resend OTP API (password reset)
export const resendOtp = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) return res.status(400).json({ error: "Email and role are required" });

    const tableName = getTableByRole(role);

    const user = await ddbDocClient.send(new GetCommand({
      TableName: tableName,
      Key: { email },
    }));

    if (!user.Item) return res.status(404).json({ error: "User not found" });

    await issueOtp({
      email,
      userName: user.Item.full_name || user.Item.name || "User",
      storeKey: getPasswordResetOtpKey(role, email),
    });

    return res.json({ message: "OTP resent successfully" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({ error: "Failed to resend OTP" });
  }
};

// Verify OTP API
export const verifyOtp = async (req, res) => {
  try {
    const { email, role, otp } = req.body;

    if (!email || !role || !otp) return res.status(400).json({ error: "Email, role, and OTP required" });

    const record = otpStore[getPasswordResetOtpKey(role, email)];
    if (!record) return res.status(400).json({ error: "OTP not found or expired" });

    if (record.expiresAt < Date.now()) {
      delete otpStore[getPasswordResetOtpKey(role, email)];
      return res.status(400).json({ error: "OTP expired" });
    }

    if (record.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });

    return res.json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
};

// Reset Password API
export const resetPassword = async (req, res) => {
  try {
    const { email, role, otp, newPassword } = req.body;

    if (!email || !role || !otp || !newPassword)
      return res.status(400).json({ error: "Email, role, OTP, and new password required" });

    const record = otpStore[getPasswordResetOtpKey(role, email)];
    if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const tableName = getTableByRole(role);

    // Update password in correct table
    await ddbDocClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { email },
      UpdateExpression: "SET #password = :password, #updated_at = :updated_at",
      ExpressionAttributeNames: { "#password": "password", "#updated_at": "updated_at" },
      ExpressionAttributeValues: { ":password": hashedPassword, ":updated_at": new Date().toISOString() },
    }));

    // Remove OTP
    delete otpStore[getPasswordResetOtpKey(role, email)];

    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
};


// Registration OTP
export const sendRegistrationOtp = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role)
      return res.status(400).json({ error: "Email and role are required" });

    const tableName = getTableByRole(role);

    const user = await ddbDocClient.send(new GetCommand({
      TableName: tableName,
      Key: { email },
    }));

    if (user.Item)
      return res.status(400).json({ error: "User already exists" });

    await issueOtp({
      email,
      userName: email.split("@")[0] || "User",
      storeKey: getRegistrationOtpKey(role, email),
    });

    return res.json({ message: "Registration OTP sent" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};

// Resend OTP API (registration)
export const resendRegistrationOtp = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role)
      return res.status(400).json({ error: "Email and role are required" });

    const tableName = getTableByRole(role);

    const user = await ddbDocClient.send(new GetCommand({
      TableName: tableName,
      Key: { email },
    }));

    if (user.Item)
      return res.status(400).json({ error: "User already exists" });

    await issueOtp({
      email,
      userName: email.split("@")[0] || "User",
      storeKey: getRegistrationOtpKey(role, email),
    });

    return res.json({ message: "Registration OTP resent successfully" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to resend OTP" });
  }
};



export const verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, role, otp } = req.body;

    const key = getRegistrationOtpKey(role, email);

    const record = otpStore[key];
    if (!record) return res.status(400).json({ error: "OTP not found or expired" });

    if (record.expiresAt < Date.now()) {
      delete otpStore[key];
      return res.status(400).json({ error: "OTP expired" });
    }

    if (record.otp !== otp)
      return res.status(400).json({ error: "Invalid OTP" });

    return res.json({ message: "OTP verified" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
};
