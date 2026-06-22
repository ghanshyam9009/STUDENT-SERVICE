import "../config/env.js";
import nodemailer from "nodemailer";
import { buildOtpEmail, buildJobAlertEmail } from "./emailTemplates.js";

const createTransporter = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

const getFromEmail = () =>
  process.env.SMTP_FROM?.trim() ||
  process.env.SMTP_USER?.trim() ||
  process.env.AWS_EMAIL?.trim() ||
  "admin@bigsources.in";

const getWebsiteUrl = () =>
  process.env.WEBSITE_URL || "https://bigsources.in";

export const sendEmail = async ({ to, subject, text, html }) => {
  const fromEmail = getFromEmail();
  const toAddresses = Array.isArray(to) ? to : [to];

  if (!fromEmail) {
    throw new Error("SMTP from email is not configured (SMTP_FROM or SMTP_USER)");
  }

  try {
    const result = await getTransporter().sendMail({
      from: `"BigSource" <${fromEmail}>`,
      to: toAddresses.join(", "),
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });

    console.log(
      "SMTP email sent:",
      result.messageId,
      `(from ${fromEmail} to ${toAddresses.join(", ")})`
    );
    return result;
  } catch (err) {
    console.error(
      `SMTP email failed (from ${fromEmail} to ${toAddresses.join(", ")}):`,
      err.message || err
    );
    throw err;
  }
};

export const sendOtpEmail = async ({
  to,
  userName,
  otp,
  expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10,
}) => {
  const websiteUrl = getWebsiteUrl();
  const { subject, html, text } = buildOtpEmail({
    userName,
    otp,
    expiryMinutes,
    websiteUrl,
  });

  return sendEmail({ to, subject, text, html });
};

export const sendJobAlertEmail = async ({
  to,
  candidateName,
  jobTitle,
  company,
  location,
  experience,
  salary,
  description,
  applyUrl,
}) => {
  const websiteUrl = getWebsiteUrl();
  const { subject, html, text } = buildJobAlertEmail({
    candidateName,
    jobTitle,
    company,
    location,
    experience,
    salary,
    description,
    applyUrl: applyUrl || `${websiteUrl}/jobs`,
    websiteUrl,
  });

  return sendEmail({ to, subject, text, html });
};
