import "../config/env.js";

const BRAND_NAME = "Bigsources.in";
const BRAND_COLOR = "#1d4ed8";
const BRAND_ACCENT = "#2563eb";
const BRAND_DARK = "#111827";
const BRAND_MUTED = "#6b7280";

const getLogoUrl = () =>
  process.env.EMAIL_LOGO_URL?.trim() ||
  `https://${process.env.BANNER_BUCKET || "banner-branding"}.s3.${process.env.AWS_REGION || "ap-southeast-1"}.amazonaws.com/email/bigsources-logo.png`;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const baseLayout = ({ title, preheader, bodyContent, websiteUrl }) => {
  const logoUrl = escapeHtml(getLogoUrl());
  const safeWebsite = escapeHtml(websiteUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:${BRAND_DARK};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px 24px;text-align:center;background:#ffffff;border-bottom:3px solid ${BRAND_ACCENT};">
              <a href="${safeWebsite}" style="text-decoration:none;display:inline-block;">
                <img
                  src="${logoUrl}"
                  alt="${BRAND_NAME}"
                  width="220"
                  style="display:block;margin:0 auto;max-width:220px;width:100%;height:auto;border:0;"
                />
              </a>
              <div style="margin-top:14px;font-size:13px;color:${BRAND_MUTED};letter-spacing:0.4px;">
                India's Trusted Job Portal
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 12px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px 22px;font-size:13px;color:${BRAND_MUTED};line-height:1.7;">
                    Best regards,<br />
                    <strong style="color:${BRAND_DARK};font-size:14px;">Team ${BRAND_NAME}</strong><br />
                    <a href="${safeWebsite}" style="color:${BRAND_ACCENT};text-decoration:none;font-weight:600;">${safeWebsite}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;margin-top:18px;">
          <tr>
            <td align="center" style="font-size:12px;color:#94a3b8;line-height:1.6;">
              &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

export const buildOtpEmail = ({
  userName = "User",
  otp,
  expiryMinutes = 10,
  websiteUrl = "https://bigsources.in",
}) => {
  const safeName = escapeHtml(userName);
  const safeOtp = escapeHtml(otp);
  const safeWebsite = escapeHtml(websiteUrl);

  const html = baseLayout({
    title: "Your OTP Verification Code",
    preheader: `Your OTP is ${otp}. Valid for ${expiryMinutes} minutes.`,
    websiteUrl: safeWebsite,
    bodyContent: `
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Verify your account</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;">
        Dear <strong>${safeName}</strong>, use the one-time password below to complete your verification on <strong>${BRAND_NAME}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
        <tr>
          <td align="center" style="background:linear-gradient(180deg,#eff6ff 0%,#f8fbff 100%);border:1px solid #bfdbfe;border-radius:16px;padding:28px 20px;">
            <div style="font-size:12px;font-weight:700;color:${BRAND_ACCENT};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:14px;">
              Your OTP Code
            </div>
            <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:${BRAND_COLOR};font-family:'Courier New',Courier,monospace;">
              ${safeOtp}
            </div>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
        <tr>
          <td style="padding:14px 16px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;font-size:14px;line-height:1.7;color:#92400e;">
            This OTP expires in <strong>${expiryMinutes} minutes</strong>. Never share this code with anyone.
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:${BRAND_MUTED};">
        If you did not request this OTP, you can safely ignore this email.
      </p>
    `,
  });

  const text = `Dear ${userName},

Verify your account on ${BRAND_NAME}.

Your OTP: ${otp}

This OTP is valid for the next ${expiryMinutes} minutes. Please do not share this code with anyone.

If you did not request this OTP, please ignore this email.

Best regards,
Team ${BRAND_NAME}
${websiteUrl}`;

  return {
    subject: `Your ${BRAND_NAME} Verification OTP`,
    html,
    text,
  };
};

export const buildJobAlertEmail = ({
  candidateName = "Candidate",
  jobTitle,
  company,
  location,
  experience,
  salary,
  description,
  applyUrl,
  websiteUrl = "https://bigsources.in",
}) => {
  const safeCandidate = escapeHtml(candidateName);
  const safeJobTitle = escapeHtml(jobTitle || "New Opportunity");
  const safeCompany = escapeHtml(company || "Not specified");
  const safeLocation = escapeHtml(location || "Not specified");
  const safeExperience = escapeHtml(experience || "Not specified");
  const safeSalary = escapeHtml(salary || "Not specified");
  const safeDescription = escapeHtml(description || "View the job for full details.");
  const safeApplyUrl = escapeHtml(applyUrl || websiteUrl);
  const safeWebsite = escapeHtml(websiteUrl);

  const detailRow = (label, value) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#4b5563;">
        <span style="display:inline-block;min-width:130px;font-weight:700;color:${BRAND_DARK};">${label}</span>
        ${value}
      </td>
    </tr>
  `;

  const html = baseLayout({
    title: `New Job: ${safeJobTitle}`,
    preheader: `New job opportunity: ${safeJobTitle} at ${safeCompany}`,
    websiteUrl: safeWebsite,
    bodyContent: `
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">New job for you</p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#4b5563;">
        Dear <strong>${safeCandidate}</strong>,<br />
        A new opportunity matching your profile is now live on <strong>${BRAND_NAME}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;border:1px solid #dbeafe;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND_COLOR} 0%,${BRAND_ACCENT} 100%);padding:18px 22px;">
            <div style="font-size:12px;font-weight:700;color:#dbeafe;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
              Job Opening
            </div>
            <div style="font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">
              ${safeJobTitle}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 22px 8px;background:#ffffff;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              ${detailRow("Company", safeCompany)}
              ${detailRow("Location", safeLocation)}
              ${detailRow("Experience", safeExperience)}
              ${detailRow("Salary", safeSalary)}
            </table>
          </td>
        </tr>
      </table>
      <div style="margin:0 0 28px;padding:18px 20px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">
        <div style="font-size:13px;font-weight:700;color:${BRAND_DARK};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">
          Job Description
        </div>
        <p style="margin:0;font-size:14px;line-height:1.8;color:#4b5563;">${safeDescription}</p>
      </div>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
        <tr>
          <td align="center" style="border-radius:12px;background:linear-gradient(135deg,${BRAND_COLOR} 0%,${BRAND_ACCENT} 100%);box-shadow:0 8px 20px rgba(37,99,235,0.28);">
            <a href="${safeApplyUrl}" style="display:inline-block;padding:15px 34px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
              Apply Now
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;text-align:center;">
        Don't miss this chance to grow your career with ${BRAND_NAME}.
      </p>
    `,
  });

  const text = `Dear ${candidateName},

A new job opportunity matching your profile has been posted on ${BRAND_NAME}.

Job Title: ${jobTitle || "New Opportunity"}
Company: ${company || "Not specified"}
Location: ${location || "Not specified"}
Experience Required: ${experience || "Not specified"}
Salary: ${salary || "Not specified"}

Job Description:
${description || "View the job for full details."}

Apply here: ${applyUrl || websiteUrl}

Best regards,
Team ${BRAND_NAME}
${websiteUrl}`;

  return {
    subject: `New Job Opportunity: ${jobTitle || `${BRAND_NAME} Job Alert`}`,
    html,
    text,
  };
};
