// ============================================================
//  AttendUCC — Notification Helper
//  backend/notificationHelper.js
// ============================================================

const { db } = require("./database");

async function createNotification(userId, title, message, type = "info") {
  try {
    await db.execute({
      sql: "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
      args: [userId, title, message, type],
    });
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
}

// Notify a student about missed session
async function notifyMissedSession(studentUserId, courseName, courseCode, date, attendanceRate) {
  const atRisk = attendanceRate < 75;
  await createNotification(
    studentUserId,
    `Missed Class: ${courseCode}`,
    atRisk
      ? `You were absent from ${courseName} on ${date}. Your attendance is now ${attendanceRate}% — below the 75% threshold. You are at risk!`
      : `You were absent from ${courseName} on ${date}. Your attendance is now ${attendanceRate}%.`,
    atRisk ? "danger" : "warning"
  );
}

// Notify a student that the QR code expired before they scanned
async function notifyQRExpired(studentUserId, courseName, courseCode) {
  await createNotification(
    studentUserId,
    `QR Code Expired: ${courseCode}`,
    `The attendance QR code for ${courseName} expired before you scanned. Contact your lecturer if you were present.`,
    "warning"
  );
}

// Notify a student their attendance is at risk
async function notifyAtRisk(studentUserId, courseName, courseCode, rate) {
  await createNotification(
    studentUserId,
    `⚠️ Attendance At Risk: ${courseCode}`,
    `Your attendance in ${courseName} has dropped to ${rate}%, which is below the 75% required threshold. Attend upcoming classes to avoid being barred from examinations.`,
    "danger"
  );
}

// Notify a student about upcoming class (30 min before)
async function notifyUpcomingClass(studentUserId, courseName, courseCode, room, startTime) {
  await createNotification(
    studentUserId,
    `Class in 30 Minutes: ${courseCode}`,
    `${courseName} starts at ${startTime} in ${room}. Remember to scan the QR code when you arrive to mark your attendance.`,
    "info"
  );
}

// Notify lecturer that attendance was marked for their session
async function notifyLecturerScan(lecturerUserId, studentName, courseName, present, enrolled) {
  await createNotification(
    lecturerUserId,
    `Attendance Marked`,
    `${studentName} just marked attendance for ${courseName}. ${present}/${enrolled} students present so far.`,
    "success"
  );
}

module.exports = {
  createNotification,
  notifyMissedSession,
  notifyQRExpired,
  notifyAtRisk,
  notifyUpcomingClass,
  notifyLecturerScan,
};
