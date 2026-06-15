import "../config/env.js";
import AWS from "aws-sdk";
import nodemailer from "nodemailer";
import { buildOtpEmail, buildJobAlertEmail } from "./emailTemplates.js";

const ses = new AWS.SES({
  region: process.env.AWS_REGION || "ap-southeast-1",
  accessKeyId: process.env.SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:
    process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
});

const getFromEmail = () => process.env.AWS_EMAIL?.trim();

const getWebsiteUrl = () =>
  process.env.WEBSITE_URL || "https://bigsource.com";

const getEmailProvider = () =>
  (process.env.EMAIL_PROVIDER || "ses").toLowerCase();

const canUseSmtp = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS?.trim()
  );

const isSesSandboxRecipientError = (err) =>
  err?.code === "MessageRejected" &&
  /not verified/i.test(String(err.message || ""));

let smtpTransport;

const getSmtpTransport = () => {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS.replace(/\s/g, ""),
      },
    });
  }
  return smtpTransport;
};

const sendViaSmtp = async ({ to, subject, text, html }) => {
  const toAddresses = Array.isArray(to) ? to : [to];
  const fromEmail = process.env.SMTP_USER?.trim();

  if (!fromEmail) {
    throw new Error("SMTP_USER is not configured");
  }

  const result = await getSmtpTransport().sendMail({
    from: `"BigSource" <${fromEmail}>`,
    to: toAddresses.join(", "),
    subject,
    text,
    html,
  });

  console.log(
    "SMTP email sent:",
    result.messageId,
    `(from ${fromEmail} to ${toAddresses.join(", ")})`
  );
  return result;
};

const sendViaSes = async ({ to, subject, text, html }) => {
  const fromEmail = getFromEmail();
  const toAddresses = Array.isArray(to) ? to : [to];

  if (!fromEmail) {
    throw new Error("AWS_EMAIL is not configured");
  }

  const result = await ses
    .sendEmail({
      Source: `"BigSource" <${fromEmail}>`,
      Destination: { ToAddresses: toAddresses },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
          ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
        },
      },
    })
    .promise();

  console.log(
    "SES email sent:",
    result.MessageId,
    `(from ${fromEmail} to ${toAddresses.join(", ")})`
  );
  return result;
};

export const sendEmail = async (opts) => {
  const provider = getEmailProvider();

  if (provider === "smtp") {
    return sendViaSmtp(opts);
  }

  try {
    return await sendViaSes(opts);
  } catch (err) {
    const fallbackEnabled = process.env.SMTP_FALLBACK !== "false";

    if (fallbackEnabled && isSesSandboxRecipientError(err) && canUseSmtp()) {
      console.warn(
        "SES sandbox blocked recipient — retrying via Gmail SMTP:",
        Array.isArray(opts.to) ? opts.to.join(", ") : opts.to
      );
      return sendViaSmtp(opts);
    }

    const fromEmail = getFromEmail();
    const toAddresses = Array.isArray(opts.to) ? opts.to : [opts.to];
    console.error(
      `SES email failed (from ${fromEmail} to ${toAddresses.join(", ")}):`,
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
