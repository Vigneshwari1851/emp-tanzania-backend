export const getOtpTemplate = (otp: string) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
        .header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; line-height: 1.6; color: #333; }
        .otp { font-size: 32px; font-weight: bold; color: #4a90e2; text-align: center; letter-spacing: 5px; margin: 20px 0; }
        .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Verification Code</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your OTP code for logging into the <strong>Employee Management Platform</strong> is:</p>
            <div class="otp">${otp}</div>
            <p>This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Employee Management Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

export const getResetPasswordTemplate = (resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
        .header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; line-height: 1.6; color: #333; text-align: center; }
        .button { display: inline-block; padding: 15px 25px; background-color: #4a90e2; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
        .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Reset Your Password</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset your password for your <strong>Employee Management Platform</strong> account.</p>
            <p>Click the button below to reset it:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p style="margin-top: 20px; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #4a90e2;">${resetLink}</p>
            <p>This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Employee Management Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

// ─── Recruitment Email Templates ────────────────────────────────────────────

const HEADER_GRADIENT = 'background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:white;padding:30px 24px;text-align:center;';
const CONTENT_STYLE  = 'padding:28px 32px;line-height:1.7;color:#374151;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;';
const BUTTON_STYLE   = 'display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white !important;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:20px 0;letter-spacing:0.5px;';
const BADGE_STYLE    = 'display:inline-block;background:#ede9fe;color:#4f46e5;padding:4px 12px;border-radius:999px;font-weight:700;font-size:13px;margin-bottom:8px;';
const INFO_ROW_STYLE = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:16px 0;';
const FOOTER_STYLE   = 'background:#f9fafb;border-top:1px solid #e8e8e8;padding:18px 24px;text-align:center;font-size:12px;color:#9ca3af;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;';
const WRAP_STYLE     = 'font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;padding:0;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;background-color:#ffffff;';

const wrapTemplate = (header: string, body: string): string => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background-color:#f3f4f6;">
  <div style="${WRAP_STYLE}">
    <div style="${HEADER_GRADIENT}">${header}</div>
    <div style="${CONTENT_STYLE}">${body}</div>
    <div style="${FOOTER_STYLE}">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} Lattium Tech &mdash; Employee Management Platform. All rights reserved.</p>
      <p style="margin:4px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Offer Sent to Candidate
 */
export const getOfferSentTemplate = (
  candidateName: string,
  jobTitle: string,
  portalUrl: string,
  expiryDate: string
): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">&#127881; You Have a Job Offer!</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Congratulations &mdash; an exciting opportunity awaits</p>`,
    `<p>Dear <strong>${candidateName}</strong>,</p>
     <p>We are delighted to inform you that we have extended a formal offer of employment to you.</p>
     <div style="${INFO_ROW_STYLE}">
       <span style="${BADGE_STYLE}">Position</span>
       <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e293b;">${jobTitle}</p>
     </div>
     <p>Please review and respond to your offer before it expires on <strong>${expiryDate}</strong>. View the complete offer letter, compensation details, and respond via your candidate portal:</p>
     <div style="text-align:center;"><a href="${portalUrl}" style="${BUTTON_STYLE}">View Your Offer Letter &rarr;</a></div>
     <p style="font-size:13px;color:#6b7280;margin-top:16px;">If the button above does not work, copy and paste this link into your browser:<br>
       <a href="${portalUrl}" style="color:#4f46e5;word-break:break-all;">${portalUrl}</a>
     </p>`
  );

/**
 * Revised Offer Sent to Candidate
 */
export const getOfferRevisedTemplate = (
  candidateName: string,
  jobTitle: string,
  portalUrl: string,
  versionNumber: number
): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">&#128196; Your Offer Has Been Revised</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">An updated offer is ready for your review</p>`,
    `<p>Dear <strong>${candidateName}</strong>,</p>
     <p>We have prepared a revised version of your job offer for the position of <strong>${jobTitle}</strong>. This is <strong>Version ${versionNumber}</strong> of your offer letter, updated based on the latest terms discussed.</p>
     <p>Please log into your candidate portal to review and respond to this revised offer:</p>
     <div style="text-align:center;"><a href="${portalUrl}" style="${BUTTON_STYLE}">Review Revised Offer &rarr;</a></div>
     <p style="font-size:13px;color:#6b7280;margin-top:16px;">
       <a href="${portalUrl}" style="color:#4f46e5;word-break:break-all;">${portalUrl}</a>
     </p>`
  );

/**
 * OTP for Candidate Portal Login
 */
export const getCandidateOtpTemplate = (candidateName: string, otp: string): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">&#128274; Your Login OTP</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Candidate Portal Verification Code</p>`,
    `<p>Dear <strong>${candidateName}</strong>,</p>
     <p>Use the one-time password below to securely access your Candidate Portal:</p>
     <div style="text-align:center;background:#ede9fe;border:2px dashed #7c3aed;border-radius:12px;padding:24px;margin:20px 0;">
       <p style="margin:0;font-size:13px;font-weight:600;color:#6d28d9;letter-spacing:1px;text-transform:uppercase;">Your OTP Code</p>
       <p style="margin:8px 0 0;font-size:40px;font-weight:900;color:#4f46e5;letter-spacing:10px;">${otp}</p>
     </div>
     <p style="font-size:13px;color:#6b7280;">&#9203; This code is valid for <strong>10 minutes</strong>. Do not share it with anyone. If you did not request this code, please contact HR immediately.</p>`
  );

/**
 * Offer Expiry Reminder
 */
export const getOfferExpiryReminderTemplate = (
  candidateName: string,
  jobTitle: string,
  portalUrl: string,
  expiryDate: string
): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">&#9200; Your Offer Is Expiring Soon</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Action required &mdash; please respond before the deadline</p>`,
    `<p>Dear <strong>${candidateName}</strong>,</p>
     <p>This is a friendly reminder that your job offer for <strong>${jobTitle}</strong> will <strong style="color:#dc2626;">expire on ${expiryDate}</strong>.</p>
     <div style="${INFO_ROW_STYLE}background:#fef2f2;border-color:#fecaca;">
       <p style="margin:0;color:#b91c1c;font-weight:700;">&#9888; Please respond before the deadline to avoid losing this offer.</p>
     </div>
     <p>Log in to your candidate portal to accept, negotiate, or decline the offer:</p>
     <div style="text-align:center;"><a href="${portalUrl}" style="${BUTTON_STYLE}">Respond to Your Offer &rarr;</a></div>
     <p style="font-size:13px;color:#6b7280;margin-top:16px;">
       <a href="${portalUrl}" style="color:#4f46e5;word-break:break-all;">${portalUrl}</a>
     </p>`
  );

/**
 * BGV Failure Alert to HR Ops
 */
export const getBgvFailureTemplate = (
  candidateName: string,
  applicationId: number,
  comments: string
): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">&#128680; BGV Check Failed &mdash; Action Required</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Background Verification Failure Alert</p>`,
    `<p>Dear HR Operations Team,</p>
     <p>The Background Verification (BGV) check for the following candidate has <strong style="color:#dc2626;">failed</strong> and requires immediate attention.</p>
     <div style="${INFO_ROW_STYLE}background:#fef2f2;border-color:#fecaca;">
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;width:140px;">Candidate Name</td><td style="font-weight:700;color:#1e293b;">${candidateName}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Application ID</td><td style="font-weight:700;color:#1e293b;">#${applicationId}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Status</td><td style="font-weight:700;color:#dc2626;">FAILED</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Comments</td><td style="color:#1e293b;">${comments || 'No additional comments provided'}</td></tr>
       </table>
     </div>
     <p>Please review this case and take appropriate action in the Recruitment module at the earliest.</p>`
  );

/**
 * Employee Created Alert to HR
 */
export const getEmployeeCreatedTemplate = (
  candidateName: string,
  employeeEmail: string,
  jobTitle: string
): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">&#9989; New Employee Onboarded</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Employee account successfully created from candidate conversion</p>`,
    `<p>Dear HR Team,</p>
     <p>A new employee account has been successfully created following a successful recruitment and offer acceptance cycle.</p>
     <div style="${INFO_ROW_STYLE}background:#f0fdf4;border-color:#bbf7d0;">
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;width:140px;">Full Name</td><td style="font-weight:700;color:#1e293b;">${candidateName}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Position</td><td style="font-weight:700;color:#1e293b;">${jobTitle}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Login Email</td><td style="font-weight:700;color:#4f46e5;">${employeeEmail}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Default Password</td><td style="font-weight:600;color:#1e293b;">Password@123 (must be changed on first login)</td></tr>
       </table>
     </div>
     <p>Please complete the employee setup process including payroll group assignment, department mapping, and system access provisioning.</p>`
  );

/**
 * Candidate Selected Email
 */
export const getCandidateSelectedTemplate = (
  candidateName: string,
  jobTitle: string
): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">&#127881; Congratulations!</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">You have been selected</p>`,
    `<p>Dear ${candidateName},</p>
     <p>We are absolutely thrilled to inform you that you have been <strong>selected</strong> for the <strong>${jobTitle}</strong> position at Lattium Tech!</p>
     <p>Our team was very impressed with your background, skills, and the conversations we had during the interview process. We believe you will be a fantastic addition to our company.</p>
     <div style="${INFO_ROW_STYLE}background:#f8fafc;border-color:#e2e8f0;text-align:center;">
       <p style="margin:0;font-weight:600;color:#1e293b;">What happens next?</p>
       <p style="margin:8px 0 0;font-size:13px;color:#475569;">Our HR team will be reaching out to you shortly with your official offer letter and details regarding the onboarding and background verification process.</p>
     </div>
     <p>Once again, congratulations! We look forward to welcoming you to the team.</p>`
  );

/**
 * Candidate Rejected Email
 */
export const getCandidateRejectedTemplate = (
  candidateName: string,
  jobTitle: string
): string =>
  wrapTemplate(
    `<h1 style="margin:0;font-size:24px;font-weight:800;">Update on Your Application</h1>
     <p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Regarding the ${jobTitle} position</p>`,
    `<p>Dear ${candidateName},</p>
     <p>Thank you very much for taking the time to apply for the <strong>${jobTitle}</strong> position at Lattium Tech and for speaking with our team.</p>
     <p>We wanted to let you know that we have chosen to move forward with other candidates who more closely match our current needs for this role.</p>
     <p>We genuinely appreciate your interest in joining us and wish you the very best in your future career endeavors.</p>
     <p>Sincerely,</p>
     <p>The Talent Acquisition Team<br>Lattium Tech</p>`
  );
