const BRAND_NAME = "BigSource Job Portal";
const BRAND_COLOR = "#1e40af";
const BRAND_ACCENT = "#2563eb";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const baseLayout = ({ title, preheader, bodyContent, websiteUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_ACCENT} 100%);padding:28px 32px;">
              <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">BigSource</div>
              <div style="font-size:13px;color:#dbeafe;margin-top:6px;">Job Portal</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <div style="border-top:1px solid #e5e7eb;padding-top:20px;font-size:13px;color:#6b7280;line-height:1.6;">
                Best regards,<br />
                <strong style="color:#111827;">BigSource Team</strong><br />
                <a href="${escapeHtml(websiteUrl)}" style="color:${BRAND_ACCENT};text-decoration:none;">${escapeHtml(websiteUrl)}</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const buildOtpEmail = ({
  userName = "User",
  otp,
  expiryMinutes = 10,
  websiteUrl = "https://bigsource.com",
}) => {
  const safeName = escapeHtml(userName);
  const safeOtp = escapeHtml(otp);
  const safeWebsite = escapeHtml(websiteUrl);

  const html = baseLayout({
    title: "Your OTP Verification Code",
    preheader: `Your OTP is ${otp}. Valid for ${expiryMinutes} minutes.`,
    websiteUrl: safeWebsite,
    bodyContent: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#374151;">Dear <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
        Thank you for using <strong>${BRAND_NAME}</strong>.
      </p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
        To complete your verification, please use the One-Time Password (OTP) below:
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
        <tr>
          <td align="center" style="background:#eff6ff;border:1px dashed #93c5fd;border-radius:12px;padding:24px;">
            <div style="font-size:14px;color:#1d4ed8;margin-bottom:10px;">🔐 Your OTP</div>
            <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:${BRAND_COLOR};">${safeOtp}</div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4b5563;">
        This OTP is valid for the next <strong>${expiryMinutes} minutes</strong>.
        Please do not share this code with anyone for security reasons.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#6b7280;">
        If you did not request this OTP, please ignore this email.
      </p>
    `,
  });

  const text = `Dear ${userName},

Thank you for using ${BRAND_NAME}.

Your OTP: ${otp}

This OTP is valid for the next ${expiryMinutes} minutes. Please do not share this code with anyone.

If you did not request this OTP, please ignore this email.

Best regards,
BigSource Team
${websiteUrl}`;

  return {
    subject: "Your BigSource Verification OTP",
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
  websiteUrl = "https://bigsource.com",
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

  const html = baseLayout({
    title: `New Job: ${safeJobTitle}`,
    preheader: `New job opportunity: ${safeJobTitle} at ${safeCompany}`,
    websiteUrl: safeWebsite,
    bodyContent: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#374151;">Dear <strong>${safeCandidate}</strong>,</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;">
        We hope you are doing well.<br />
        A new job opportunity matching your profile has been posted on <strong>${BRAND_NAME}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
        <tr>
          <td style="padding:20px 22px;">
            <div style="font-size:14px;color:#6b7280;margin-bottom:8px;">📌 Job Title</div>
            <div style="font-size:20px;font-weight:700;color:#111827;margin-bottom:18px;">${safeJobTitle}</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#4b5563;"><strong>🏢 Company:</strong> ${safeCompany}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#4b5563;"><strong>📍 Location:</strong> ${safeLocation}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#4b5563;"><strong>💼 Experience Required:</strong> ${safeExperience}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#4b5563;"><strong>💰 Salary:</strong> ${safeSalary}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <div style="margin:0 0 24px;">
        <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">📝 Job Description</div>
        <p style="margin:0;font-size:14px;line-height:1.8;color:#4b5563;">${safeDescription}</p>
      </div>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
        <tr>
          <td align="center" style="border-radius:10px;background:${BRAND_ACCENT};">
            <a href="${safeApplyUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
              Apply Now
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
        Don't miss this opportunity to grow your career!
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
BigSource Team
${websiteUrl}`;

  return {
    subject: `New Job Opportunity: ${jobTitle || "BigSource Job Alert"}`,
    html,
    text,
  };
};
