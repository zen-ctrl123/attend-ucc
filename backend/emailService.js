// ============================================================
//  AttendUCC — Email Service
//  backend/emailService.js
//  Powered by Resend (resend.com)
// ============================================================

const { Resend } = require("resend");

const resend   = new Resend(process.env.RESEND_API_KEY);
const FROM     = process.env.FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "AttendUCC";
const APP_URL  = process.env.APP_URL || "https://attend-ucc.vercel.app";

// ── Shared email wrapper ──────────────────────────────────
async function sendEmail({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from:    `${APP_NAME} <${FROM}>`,
      to:      [to],
      subject,
      html,
    });
    if (error) { console.error("Email error:", error); return false; }
    console.log(`✅ Email sent to ${to} — ${subject}`);
    return true;
  } catch (err) {
    console.error("Email send failed:", err.message);
    return false;
  }
}

// ── Shared HTML template ──────────────────────────────────
function template(title, body, btnText = null, btnUrl = null) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:#003366;padding:28px 36px;text-align:center;">
                <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:0.02em;">
                  🎓 AttendUCC
                </h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">
                  University of Cape Coast · Smart Attendance System
                </p>
              </td>
            </tr>

            <!-- Gold bar -->
            <tr><td style="height:4px;background:#C9A84C;"></td></tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 36px 28px;">
                <h2 style="margin:0 0 16px;color:#003366;font-size:20px;font-weight:700;">${title}</h2>
                ${body}
                ${btnText && btnUrl ? `
                  <div style="text-align:center;margin-top:28px;">
                    <a href="${btnUrl}"
                       style="background:#003366;color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">
                      ${btnText}
                    </a>
                  </div>
                ` : ""}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f8f9fb;padding:20px 36px;border-top:1px solid #e0e4ea;text-align:center;">
                <p style="margin:0;color:#aaa;font-size:11px;line-height:1.6;">
                  This is an automated message from AttendUCC.<br>
                  University of Cape Coast · Department of Computer Science & IT<br>
                  <a href="${APP_URL}" style="color:#003366;">attend-ucc.vercel.app</a>
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// ═══════════════════════════════════════════════════════════
//  EMAIL FUNCTIONS
// ═══════════════════════════════════════════════════════════

// 1. Forgot Password — send reset link
async function sendPasswordReset(to, name, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  return sendEmail({
    to,
    subject: "Reset Your AttendUCC Password",
    html: template(
      "Password Reset Request",
      `
        <p style="color:#444;font-size:14px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="color:#444;font-size:14px;line-height:1.7;">
          We received a request to reset your AttendUCC password. Click the button below to set a new password.
          This link expires in <strong>1 hour</strong>.
        </p>
        <p style="color:#444;font-size:14px;line-height:1.7;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      `,
      "Reset My Password",
      resetUrl
    ),
  });
}

// 2. Pre-class reminder — 30 minutes before class
async function sendClassReminder(to, name, courseName, courseCode, room, startTime) {
  return sendEmail({
    to,
    subject: `⏰ Class Reminder: ${courseCode} starts in 30 minutes`,
    html: template(
      "You Have a Class Soon",
      `
        <p style="color:#444;font-size:14px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="color:#444;font-size:14px;line-height:1.7;">
          This is a reminder that you have a class starting in <strong>30 minutes</strong>.
        </p>
        <table style="width:100%;background:#f8f9fb;border-radius:10px;padding:20px;margin:20px 0;border-left:4px solid #003366;">
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Course</span><br>
            <strong style="color:#003366;font-size:15px;">${courseName}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Code</span><br>
            <strong style="color:#1a1a2e;font-size:14px;">${courseCode}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Time</span><br>
            <strong style="color:#1a1a2e;font-size:14px;">${startTime}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Room</span><br>
            <strong style="color:#1a1a2e;font-size:14px;">${room}</strong>
          </td></tr>
        </table>
        <p style="color:#444;font-size:13px;line-height:1.7;">
          Remember to scan the QR code when you arrive to mark your attendance.
          Attendance below <strong>75%</strong> may affect your eligibility to sit examinations.
        </p>
      `,
      "Open AttendUCC",
      APP_URL
    ),
  });
}

// 3. QR code expiry alert — notify student the QR has expired
async function sendQRExpiryAlert(to, name, courseName, courseCode) {
  return sendEmail({
    to,
    subject: `⚠️ QR Code Expired: ${courseCode} attendance window closed`,
    html: template(
      "QR Code Has Expired",
      `
        <p style="color:#444;font-size:14px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="color:#444;font-size:14px;line-height:1.7;">
          The QR code for <strong>${courseName} (${courseCode})</strong> has expired.
          If you were present in class but did not scan in time, please speak to your lecturer directly
          to have your attendance manually recorded.
        </p>
        <div style="background:#fff8e6;border-left:4px solid #C9A84C;border-radius:8px;padding:14px 18px;margin:20px 0;">
          <p style="margin:0;color:#b07800;font-size:13px;font-weight:600;">
            ⚠️ Remember: QR codes are valid for 10 minutes from the time your lecturer generates them.
            Make sure to scan as soon as the code is displayed.
          </p>
        </div>
      `,
      "Open AttendUCC",
      APP_URL
    ),
  });
}

// 4. Missed session alert — notify student they were marked absent
async function sendMissedSessionAlert(to, name, courseName, courseCode, sessionDate, currentRate) {
  const atRisk  = currentRate < 75;
  const rateColor = atRisk ? "#8B0000" : "#1a7a4a";
  return sendEmail({
    to,
    subject: `📋 Missed Class: ${courseCode} on ${sessionDate}`,
    html: template(
      "You Missed a Class",
      `
        <p style="color:#444;font-size:14px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="color:#444;font-size:14px;line-height:1.7;">
          Our records show that you were absent from the following session:
        </p>
        <table style="width:100%;background:#f8f9fb;border-radius:10px;padding:20px;margin:20px 0;border-left:4px solid #8B0000;">
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Course</span><br>
            <strong style="color:#003366;font-size:15px;">${courseName}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Code</span><br>
            <strong style="color:#1a1a2e;font-size:14px;">${courseCode}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Date</span><br>
            <strong style="color:#1a1a2e;font-size:14px;">${sessionDate}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Current Attendance Rate</span><br>
            <strong style="color:${rateColor};font-size:16px;">${currentRate}%</strong>
          </td></tr>
        </table>
        ${atRisk ? `
          <div style="background:#fdecea;border-left:4px solid #8B0000;border-radius:8px;padding:14px 18px;margin:20px 0;">
            <p style="margin:0;color:#8B0000;font-size:13px;font-weight:600;">
              🚨 Your attendance is below the 75% threshold. You are at risk of being barred from sitting your examination for this course.
              Please contact your lecturer immediately.
            </p>
          </div>
        ` : `
          <p style="color:#444;font-size:13px;line-height:1.7;">
            Your attendance is currently acceptable, but please ensure you attend future sessions to maintain your standing.
          </p>
        `}
      `,
      "View My Attendance",
      APP_URL
    ),
  });
}

// 5. Welcome email — sent when a new account is created
async function sendWelcomeEmail(to, name, role, identifier) {
  return sendEmail({
    to,
    subject: `Welcome to AttendUCC, ${name.split(" ")[0]}!`,
    html: template(
      `Welcome to AttendUCC!`,
      `
        <p style="color:#444;font-size:14px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="color:#444;font-size:14px;line-height:1.7;">
          Your AttendUCC account has been created successfully. You can now log in to the system.
        </p>
        <table style="width:100%;background:#f8f9fb;border-radius:10px;padding:20px;margin:20px 0;border-left:4px solid #003366;">
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Role</span><br>
            <strong style="color:#003366;font-size:14px;">${role === "student" ? "Student" : "Lecturer"}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">${role === "student" ? "Index Number" : "Staff ID"}</span><br>
            <strong style="color:#1a1a2e;font-size:14px;">${identifier}</strong>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Email</span><br>
            <strong style="color:#1a1a2e;font-size:14px;">${to}</strong>
          </td></tr>
        </table>
        <p style="color:#444;font-size:13px;line-height:1.7;">
          ${role === "student"
            ? "You can now scan QR codes to mark your attendance, track your attendance records, and receive alerts when your attendance is at risk."
            : "You can now create sessions, generate QR codes for attendance, and view detailed attendance reports for your courses."
          }
        </p>
      `,
      "Log In to AttendUCC",
      APP_URL
    ),
  });
}

// 6. Two-factor login/registration — one-time verification code
async function sendOtpEmail(to, name, otp) {
  return sendEmail({
    to,
    subject: `${otp} is your AttendUCC verification code`,
    html: template(
      "Verify It's You",
      `
        <p style="color:#444;font-size:14px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
        <p style="color:#444;font-size:14px;line-height:1.7;">
          Enter this code to continue. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;background:#f8f9fb;border:1px solid #e0e4ea;border-radius:10px;
                       padding:16px 32px;font-family:'Courier New',monospace;font-size:32px;font-weight:800;
                       letter-spacing:0.3em;color:#003366;">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.7;">
          If you didn't request this code, you can safely ignore this email — no one can access your account without it.
        </p>
      `
    ),
  });
}

module.exports = {
  sendPasswordReset,
  sendClassReminder,
  sendQRExpiryAlert,
  sendMissedSessionAlert,
  sendWelcomeEmail,
  sendOtpEmail,
};