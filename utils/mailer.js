import "../config/env.js";
import AWS from "aws-sdk";
import { buildOtpEmail, buildJobAlertEmail } from "./emailTemplates.js";

const ses = new AWS.SES({
  region: process.env.AWS_REGION || "ap-southeast-1",
  accessKeyId: process.env.SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:
    process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
});

const getFromEmail = () =>
  process.env.AWS_EMAIL?.trim() || "admin@bigsources.in";

const getWebsiteUrl = () =>
  process.env.WEBSITE_URL || "https://bigsources.in";

export const sendEmail = async ({ to, subject, text, html }) => {
  const fromEmail = getFromEmail();
  const toAddresses = Array.isArray(to) ? to : [to];

  if (!fromEmail) {
    throw new Error("AWS_EMAIL is not configured");
  }

  try {
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
  } catch (err) {
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
