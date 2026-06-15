import AWS from "aws-sdk";
import dotenv from "dotenv";
import { buildOtpEmail, buildJobAlertEmail } from "./emailTemplates.js";

dotenv.config();

const ses = new AWS.SES({
  region: process.env.AWS_REGION || "ap-southeast-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const getFromEmail = () =>
  process.env.SES_FROM_EMAIL || process.env.SMTP_USER;

const getWebsiteUrl = () =>
  process.env.WEBSITE_URL || "https://bigsource.com";

export const sendEmail = async ({ to, subject, text, html }) => {
  const fromEmail = getFromEmail();

  if (!fromEmail) {
    throw new Error("SES_FROM_EMAIL is not configured");
  }

  try {
    const result = await ses
      .sendEmail({
        Source: `"BigSource" <${fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
        },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
            ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
          },
        },
      })
      .promise();

    console.log("SES email sent:", result.MessageId);
    return result;
  } catch (err) {
    console.error("SES email sending error:", err);
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
