// Render has no outbound IPv6 route, but Node's default DNS resolution can
// still hand back an IPv6 address for a dual-stack host like smtp.gmail.com
// ahead of its IPv4 one -- causing ENETUNREACH on the socket connect, not a
// DNS failure, so nothing upstream even retries. Forcing IPv4-first here
// fixes it process-wide, regardless of whether an individual library (e.g.
// nodemailer) correctly threads a per-call "family" option through every
// one of its own connection paths. Must run before anything that opens an
// outbound connection is required.
require("dns").setDefaultResultOrder("ipv4first");

const express    = require("express");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const crypto     = require("crypto");
const { db, initDatabase } = require("./database");
const { getDistanceMetres } = require("./locationUtils");
const {
  sendPasswordReset,
  sendClassReminder,
  sendQRExpiryAlert,
  sendMissedSessionAlert,
  sendWelcomeEmail,
  sendOtpEmail,
} = require("./emailService");
const {
  notifyMissedSession,
  notifyQRExpired,
  notifyAtRisk,
  notifyLecturerScan,
} = require("./notificationHelper");

// Load deactivation job
require("./deactivateJob");

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || "attenducc-secret-key-ucc-2025";

// Dedicated signing secret for QR payloads — falls back to reusing SECRET so
// it works with zero new config, but should get its own value in production
// so a leaked QR secret can't be used to forge login tokens (or vice versa).
const QR_SECRET         = process.env.QR_SECRET || SECRET;
const QR_EXPIRY_MINUTES = Number(process.env.QR_EXPIRY_MINUTES) || 10;

app.use(cors());
app.use(express.json());

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Emails are case-insensitive at every real provider, but SQLite's UNIQUE
// constraint is case-sensitive by default — without this, "A@x.com" and
// "a@x.com" register as two separate accounts.
const normalizeEmail = (email) => (email || "").trim().toLowerCase();

const plain  = (row)  => (row ? { ...row } : row);
const plains = (rows) => rows.map(plain);

// ── UCC Lecture Halls ──
const LECTURE_HALLS = {
  "LT 1":            { lat: 5.1061, lng: -1.2771, radius: 80  },
  "LT 2":            { lat: 5.1058, lng: -1.2768, radius: 80  },
  "LT 3":            { lat: 5.1055, lng: -1.2764, radius: 80  },
  "LT 4":            { lat: 5.1052, lng: -1.2761, radius: 80  },
  "ICT Lab 1":       { lat: 5.1049, lng: -1.2759, radius: 60  },
  "ICT Lab 2":       { lat: 5.1047, lng: -1.2757, radius: 60  },
  "Science Theatre": { lat: 5.1065, lng: -1.2775, radius: 100 },
  "Main Auditorium": { lat: 5.1070, lng: -1.2780, radius: 120 },
};

app.get("/api/halls", (req, res) => {
  res.json(Object.entries(LECTURE_HALLS).map(([name, data]) => ({ name, ...data })));
});

// Lecturers type the room name free-form ("LT4", "lt 4", "LT 4" should all
// match) — an exact-match lookup silently drops the hall's fixed
// coordinates (and the geofence radius that goes with them) over a detail
// as small as a missing space.
const normalizeRoomKey  = (room) => (room || "").toLowerCase().replace(/\s+/g, "");
const LECTURE_HALLS_KEY = Object.fromEntries(
  Object.entries(LECTURE_HALLS).map(([name, data]) => [normalizeRoomKey(name), data])
);
const findHall = (room) => LECTURE_HALLS_KEY[normalizeRoomKey(room)] || null;

// ══════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════

// Two-factor auth: registration and every login stop short of issuing a
// token and instead require this code, emailed to the account's address.
const OTP_EXPIRY_MINUTES = 10;

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000)); // always 6 digits
}

async function issueOtp(user) {
  const otp    = generateOtp();
  const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  await db.execute({ sql: "UPDATE users SET otp_code = ?, otp_expiry = ? WHERE id = ?", args: [otp, expiry, user.id] });
  sendOtpEmail(user.email, user.name, otp).catch(console.error);
}

async function buildProfile(user) {
  let profile = { id: user.id, name: user.name, email: user.email, role: user.role };
  if (user.role === "student") {
    const sr = await db.execute({ sql: "SELECT * FROM students WHERE user_id = ?", args: [user.id] });
    const s  = sr.rows[0];
    profile  = { ...profile, studentId: s.id, indexNumber: s.index_number, level: s.level, programme: s.programme };
  }
  if (user.role === "lecturer") {
    const lr = await db.execute({ sql: "SELECT * FROM lecturers WHERE user_id = ?", args: [user.id] });
    const l  = lr.rows[0];
    profile  = { ...profile, lecturerId: l.id, staffId: l.staff_id, dept: l.dept };
  }
  return profile;
}

app.post("/api/auth/register", async (req, res) => {
  const { name, password, role, index_number, staff_id, level, dept, programme, courses } = req.body;
  const email = normalizeEmail(req.body.email);
  if (!name || !email || !password || !role) return res.status(400).json({ error: "Please fill in all required fields." });

  try {
    const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
    if (existing.rows.length > 0) return res.status(400).json({ error: "An account with this email already exists." });

    const hashed    = bcrypt.hashSync(password, 10);
    const userResult = await db.execute({
      sql: "INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)",
      args: [name, email, hashed, role],
    });
    const userId = userResult.lastInsertRowid;
    let identifier = "";

    if (role === "student") {
      if (!index_number) return res.status(400).json({ error: "Index number is required." });
      identifier = index_number;
      await db.execute({
        sql: "INSERT INTO students (user_id, index_number, level, programme) VALUES (?, ?, ?, ?)",
        args: [userId, index_number, level || "100", programme || "BSc. Information Technology & Computing"],
      });
      const newStudentRes = await db.execute({ sql: "SELECT id FROM students WHERE user_id = ?", args: [userId] });
      const newStudentId  = newStudentRes.rows[0].id;
      const allCoursesRes = await db.execute({ sql: "SELECT id FROM courses", args: [] });
      if (allCoursesRes.rows.length > 0) {
        await db.batch(allCoursesRes.rows.map(c => ({
          sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [newStudentId, c.id]
        })), "write");
      }
    }

    if (role === "lecturer") {
      if (!staff_id) return res.status(400).json({ error: "Staff ID is required." });
      identifier = staff_id;
      const lecturerResult = await db.execute({
        sql: "INSERT INTO lecturers (user_id, staff_id, dept) VALUES (?, ?, ?)",
        args: [userId, staff_id, dept || "Computer Science & IT"],
      });
      const lecturerId = lecturerResult.lastInsertRowid;

      if (Array.isArray(courses) && courses.filter(c => c.name && c.code).length > 0) {
        const validCourses = courses.filter(c => c.name && c.code);
        await db.batch(validCourses.map(c => ({
          sql: "INSERT OR IGNORE INTO courses (code, name, lecturer_id) VALUES (?, ?, ?)",
          args: [c.code.toUpperCase().trim(), c.name.trim(), lecturerId],
        })), "write");
        const allStudentsRes = await db.execute({ sql: "SELECT id FROM students", args: [] });
        const newCoursesRes  = await db.execute({ sql: "SELECT id FROM courses WHERE lecturer_id = ?", args: [lecturerId] });
        if (allStudentsRes.rows.length > 0 && newCoursesRes.rows.length > 0) {
          const stmts = [];
          for (const s of allStudentsRes.rows) for (const c of newCoursesRes.rows) {
            stmts.push({ sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [s.id, c.id] });
          }
          await db.batch(stmts, "write");
        }
      }
    }

    sendWelcomeEmail(email, name, role, identifier).catch(console.error);
    await issueOtp({ id: userId, name, email });
    res.json({ requiresOtp: true, email, message: "Account created. Enter the code sent to your email to finish signing in." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { identifier, password, role } = req.body;
  if (!identifier || !password || !role) return res.status(400).json({ error: "Please fill in all fields." });

  try {
    let userRes = await db.execute({ sql: "SELECT * FROM users WHERE email = ? AND role = ?", args: [normalizeEmail(identifier), role] });
    let user    = userRes.rows[0];

    if (!user) {
      if (role === "student") {
        const sr = await db.execute({ sql: "SELECT * FROM students WHERE index_number = ?", args: [identifier] });
        const s  = sr.rows[0];
        if (s) { const ur = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [s.user_id] }); user = ur.rows[0]; }
      }
      if (role === "lecturer") {
        const lr = await db.execute({ sql: "SELECT * FROM lecturers WHERE staff_id = ?", args: [identifier] });
        const l  = lr.rows[0];
        if (l) { const ur = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [l.user_id] }); user = ur.rows[0]; }
      }
    }

    if (!user) return res.status(401).json({ error: "Account not found. Check your ID and role." });
    if (user.role !== role) return res.status(401).json({ error: "Incorrect role selected." });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password." });

    if (user.active === 0) {
      return res.status(403).json({ error: "This account has been deactivated due to one year of inactivity. Please contact your department administrator." });
    }

    await issueOtp(user);
    res.json({ requiresOtp: true, email: user.email, message: "A verification code has been sent to your email." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp   = (req.body.otp || "").trim();
  if (!email || !otp) return res.status(400).json({ error: "Email and code are required." });

  try {
    const userRes = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user    = userRes.rows[0];
    if (!user || !user.otp_code) return res.status(400).json({ error: "Invalid or expired code. Request a new one." });
    if (user.otp_code !== otp) return res.status(400).json({ error: "Incorrect code. Please try again." });
    if (new Date() > new Date(user.otp_expiry)) return res.status(400).json({ error: "This code has expired. Request a new one." });

    if (user.active === 0) {
      return res.status(403).json({ error: "This account has been deactivated due to one year of inactivity. Please contact your department administrator." });
    }

    await db.execute({
      sql: "UPDATE users SET otp_code = NULL, otp_expiry = NULL, last_active = ? WHERE id = ?",
      args: [new Date().toISOString(), user.id],
    });

    const profile = await buildProfile(user);
    const token   = jwt.sign(profile, SECRET, { expiresIn: "8h" });
    res.json({ token, user: profile });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

app.post("/api/auth/resend-otp", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const userRes = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user    = userRes.rows[0];
    if (!user) return res.status(400).json({ error: "Account not found." });

    // A code is only ever issued with a fresh OTP_EXPIRY_MINUTES window, so
    // working backward from otp_expiry tells us when it was sent without a
    // separate "last sent" column.
    if (user.otp_expiry) {
      const issuedAt         = new Date(user.otp_expiry).getTime() - OTP_EXPIRY_MINUTES * 60 * 1000;
      const secondsSinceSent = (Date.now() - issuedAt) / 1000;
      if (secondsSinceSent < 30) return res.status(429).json({ error: "Please wait a moment before requesting another code." });
    }

    await issueOtp(user);
    res.json({ message: "A new code has been sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resend code." });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: "Email is required." });
  try {
    const userRes = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user    = userRes.rows[0];
    if (!user) return res.json({ message: "If an account exists, a reset link has been sent." });
    const resetToken  = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.execute({ sql: "UPDATE users SET reset_token = ?, reset_expiry = ? WHERE id = ?", args: [resetToken, resetExpiry, user.id] });
    await sendPasswordReset(user.email, user.name, resetToken);
    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    res.status(500).json({ error: "Failed to process request." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and password are required." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  try {
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE reset_token = ? AND reset_expiry > ?",
      args: [token, new Date().toISOString()],
    });
    const user = userRes.rows[0];
    if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });
    const hashed = bcrypt.hashSync(password, 10);
    await db.execute({ sql: "UPDATE users SET password = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?", args: [hashed, user.id] });
    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// ══════════════════════════════════════════════════════
//  NOTIFICATIONS ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/notifications", authenticate, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      args: [req.user.id],
    });
    res.json(plains(result.rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to load notifications." });
  }
});

app.post("/api/notifications/:id/read", authenticate, async (req, res) => {
  try {
    await db.execute({
      sql: "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      args: [req.params.id, req.user.id],
    });
    res.json({ message: "Marked as read." });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification." });
  }
});

app.post("/api/notifications/read-all", authenticate, async (req, res) => {
  try {
    await db.execute({
      sql: "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
      args: [req.user.id],
    });
    res.json({ message: "All marked as read." });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notifications." });
  }
});

// ══════════════════════════════════════════════════════
//  COURSES ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/courses", authenticate, async (req, res) => {
  try {
    if (req.user.role === "lecturer") {
      const result = await db.execute({
        sql: `SELECT c.*, COUNT(e.student_id) as enrolled FROM courses c
              LEFT JOIN enrolments e ON e.course_id = c.id WHERE c.lecturer_id = ? GROUP BY c.id`,
        args: [req.user.lecturerId],
      });
      return res.json(plains(result.rows));
    }
    if (req.user.role === "student") {
      const result = await db.execute({
        sql: `SELECT c.*,
                (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id AND s.status = 'ended') as total_sessions,
                (SELECT COUNT(*) FROM attendance_records ar JOIN sessions s ON s.id = ar.session_id
                  WHERE s.course_id = c.id AND ar.student_id = ? AND ar.status IN ('present','late')) as attended
              FROM courses c JOIN enrolments e ON e.course_id = c.id WHERE e.student_id = ?`,
        args: [req.user.studentId, req.user.studentId],
      });
      return res.json(plains(result.rows));
    }
    res.status(403).json({ error: "Access denied." });
  } catch (err) {
    res.status(500).json({ error: "Failed to load courses." });
  }
});

app.post("/api/courses", authenticate, async (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can add courses." });
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: "Course name and code are required." });
  try {
    const existing = await db.execute({ sql: "SELECT id FROM courses WHERE code = ?", args: [code.toUpperCase().trim()] });
    if (existing.rows.length > 0) return res.status(400).json({ error: "A course with this code already exists." });
    const result = await db.execute({
      sql: "INSERT INTO courses (code, name, lecturer_id) VALUES (?, ?, ?)",
      args: [code.toUpperCase().trim(), name.trim(), req.user.lecturerId],
    });
    const allStudentsRes = await db.execute({ sql: "SELECT id FROM students", args: [] });
    if (allStudentsRes.rows.length > 0) {
      await db.batch(allStudentsRes.rows.map(s => ({
        sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [s.id, result.lastInsertRowid]
      })), "write");
    }
    res.json({ message: "Course added successfully.", courseId: Number(result.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ error: "Failed to add course." });
  }
});

// ══════════════════════════════════════════════════════
//  SESSIONS ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/sessions/today", authenticate, async (req, res) => {
  try {
    const today  = new Date().toISOString().split("T")[0];
    const result = await db.execute({
      sql: `SELECT s.*, c.name as course_name, c.code as course_code,
              COUNT(e.student_id) as enrolled,
              (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status IN ('present','late')) as present
            FROM sessions s JOIN courses c ON c.id = s.course_id
            LEFT JOIN enrolments e ON e.course_id = c.id
            WHERE c.lecturer_id = ? AND s.date = ? GROUP BY s.id`,
      args: [req.user.lecturerId, today],
    });
    res.json(plains(result.rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to load sessions." });
  }
});

app.post("/api/sessions", authenticate, async (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can create sessions." });
  try {
    const { course_id, room } = req.body;
    const today    = new Date().toISOString().split("T")[0];
    const hallData = findHall(room) || {};
    const result   = await db.execute({
      sql: "INSERT INTO sessions (course_id, room, date, start_time, status, hall_lat, hall_lng, hall_radius) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
      args: [course_id, room, today, new Date().toTimeString().slice(0, 5), hallData.lat || null, hallData.lng || null, hallData.radius || 100],
    });
    const sessionId   = Number(result.lastInsertRowid);
    const studentsRes = await db.execute({ sql: "SELECT student_id FROM enrolments WHERE course_id = ?", args: [course_id] });
    if (studentsRes.rows.length > 0) {
      await db.batch(studentsRes.rows.map(s => ({
        sql: "INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'absent')", args: [sessionId, s.student_id]
      })), "write");
    }
    res.json({ sessionId, message: "Session created." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create session." });
  }
});

app.post("/api/sessions/:id/qr", authenticate, async (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can generate QR codes." });
  try {
    const sessionId              = req.params.id;
    const { lecturer_lat, lecturer_lng } = req.body;

    const sessionRes = await db.execute({
      sql: `SELECT s.*, c.name as course_name, c.code as course_code, c.id as course_id, c.lecturer_id
            FROM sessions s JOIN courses c ON c.id = s.course_id WHERE s.id = ?`,
      args: [sessionId],
    });
    const session = sessionRes.rows[0];
    if (!session) return res.status(404).json({ error: "Session not found." });

    const expiry = new Date(Date.now() + QR_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Keep this payload as small as possible — every extra field makes the
    // printed/displayed QR denser and harder for a real phone camera to
    // resolve. Session/location/course data all get looked up server-side
    // from sessionId at scan time anyway (needed regardless, to check the
    // token hasn't been revoked by a regenerate), so nothing else needs to
    // ride along in the signed token itself.
    const qrJWT = jwt.sign(
      { sessionId: Number(sessionId) },
      QR_SECRET,
      { expiresIn: `${QR_EXPIRY_MINUTES}m` }
    );

    await db.execute({
      sql: "UPDATE sessions SET qr_token = ?, qr_expiry = ?, lecturer_lat = ?, lecturer_lng = ? WHERE id = ?",
      args: [qrJWT, expiry, lecturer_lat || null, lecturer_lng || null, sessionId],
    });

    // After the QR expires, notify students still marked absent
    setTimeout(async () => {
      try {
        const absentRes = await db.execute({
          sql: `SELECT u.email, u.name, u.id as user_id FROM attendance_records ar
                JOIN students st ON st.id = ar.student_id JOIN users u ON u.id = st.user_id
                WHERE ar.session_id = ? AND ar.status = 'absent'`,
          args: [sessionId],
        });
        for (const student of absentRes.rows) {
          sendQRExpiryAlert(student.email, student.name, session.course_name, session.course_code).catch(console.error);
          notifyQRExpired(student.user_id, session.course_name, session.course_code).catch(console.error);
        }
      } catch (err) { console.error("QR expiry notification error:", err); }
    }, QR_EXPIRY_MINUTES * 60 * 1000);

    res.json({ token: qrJWT, expiry, qrValue: qrJWT, locationCaptured: !!(lecturer_lat && lecturer_lng) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate QR code." });
  }
});

app.post("/api/sessions/:id/end", authenticate, async (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can end sessions." });
  try {
    await db.execute({
      sql: "UPDATE sessions SET status = 'ended', end_time = ? WHERE id = ?",
      args: [new Date().toTimeString().slice(0, 5), req.params.id],
    });

    const sessionId  = req.params.id;
    const sessionRes = await db.execute({
      sql: "SELECT s.*, c.name as course_name, c.code as course_code, c.id as cid FROM sessions s JOIN courses c ON c.id = s.course_id WHERE s.id = ?",
      args: [sessionId],
    });
    const session = sessionRes.rows[0];

    if (session) {
      const absentRes = await db.execute({
        sql: `SELECT u.email, u.name, u.id as user_id, st.id as student_id FROM attendance_records ar
              JOIN students st ON st.id = ar.student_id JOIN users u ON u.id = st.user_id
              WHERE ar.session_id = ? AND ar.status = 'absent'`,
        args: [sessionId],
      });

      for (const student of absentRes.rows) {
        try {
          const rateRes = await db.execute({
            sql: `SELECT COUNT(CASE WHEN ar.status IN ('present','late') THEN 1 END) as attended, COUNT(ar.id) as total
                  FROM attendance_records ar JOIN sessions s ON s.id = ar.session_id
                  WHERE s.course_id = ? AND ar.student_id = ? AND s.status = 'ended'`,
            args: [session.cid, student.student_id],
          });
          const rate = rateRes.rows[0];
          const pct  = rate.total > 0 ? Math.round((rate.attended / rate.total) * 100) : 0;

          sendMissedSessionAlert(student.email, student.name, session.course_name, session.course_code, session.date, pct).catch(console.error);
          notifyMissedSession(student.user_id, session.course_name, session.course_code, session.date, pct).catch(console.error);

          if (pct < 75) {
            notifyAtRisk(student.user_id, session.course_name, session.course_code, pct).catch(console.error);
          }
        } catch (err) { console.error("Missed session notification error:", err); }
      }
    }

    res.json({ message: "Session ended." });
  } catch (err) {
    res.status(500).json({ error: "Failed to end session." });
  }
});

// ══════════════════════════════════════════════════════
//  ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════

app.post("/api/attendance/scan", authenticate, async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Only students can scan QR codes." });
  try {
    const { qr_token, gps_lat, gps_lng, ip_address, device_id } = req.body;
    if (!qr_token) return res.status(400).json({ error: "Invalid QR code. Please scan the correct code." });

    let payload;
    try {
      payload = jwt.verify(qr_token, QR_SECRET);
    } catch (err) {
      return res.status(400).json({
        error: err.name === "TokenExpiredError"
          ? "This QR code has expired. Ask your lecturer to generate a new one."
          : "Invalid QR code. Please scan the correct code.",
      });
    }

    const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE id = ?", args: [payload.sessionId] });
    const session    = sessionRes.rows[0];
    if (!session) return res.status(400).json({ error: "Invalid QR code. Please scan the correct code." });
    // A regenerated QR overwrites sessions.qr_token, so a stale (but still
    // unexpired/unforged) photographed code stops working immediately.
    if (session.qr_token !== qr_token) return res.status(400).json({ error: "This QR code is no longer valid. Ask your lecturer for the current code." });
    if (session.status !== "active") return res.status(400).json({ error: "This session has already ended." });

    const enrolmentRes = await db.execute({ sql: "SELECT * FROM enrolments WHERE student_id = ? AND course_id = ?", args: [req.user.studentId, session.course_id] });
    if (enrolmentRes.rows.length === 0) return res.status(403).json({ error: "You are not enrolled in this course." });

    const existingRes = await db.execute({ sql: "SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?", args: [session.id, req.user.studentId] });
    if (["present", "late"].includes(existingRes.rows[0]?.status)) return res.status(400).json({ error: "You have already marked attendance for this session." });

    // Per-device check, not per-IP: a public IP is shared by everyone on the
    // same WiFi (the normal case in a classroom), so it can't tell "one
    // phone, several accounts" apart from "several phones, one network".
    // A per-browser device ID can.
    if (device_id) {
      const deviceUsedRes = await db.execute({
        sql: "SELECT * FROM attendance_records WHERE session_id = ? AND device_id = ? AND status IN ('present','late') AND student_id != ?",
        args: [session.id, device_id, req.user.studentId],
      });
      if (deviceUsedRes.rows.length > 0) return res.status(400).json({ error: "This device has already been used to mark attendance for another student. Proxy attendance is not allowed." });
    }

    if (!gps_lat || !gps_lng) return res.status(400).json({ error: "Location is required to mark attendance. Please enable location access and try again." });

    // The lecturer's own live location, captured when this QR was issued —
    // not a re-derived reading, and NOT the static hall coordinates. Those
    // are never precisely surveyed and have been wrong by kilometres in
    // practice, which is worse than skipping the check: a bad fixed point
    // silently rejects every real student, whereas no reference point just
    // means this particular session isn't geofenced. hall_radius is still
    // used as the tolerance once there IS a real reference point — the
    // *size* of a guessed default is harmless, only its *position* isn't.
    const refLat = session.lecturer_lat;
    const refLng = session.lecturer_lng;
    const radius = session.hall_radius || 80;
    if (refLat && refLng) {
      const distance = getDistanceMetres(parseFloat(gps_lat), parseFloat(gps_lng), parseFloat(refLat), parseFloat(refLng));
      if (distance > radius) return res.status(400).json({ error: `You are ${Math.round(distance)}m away from the classroom. Must be within ${radius}m.` });
    }

    const sessionStart = new Date(`${session.date}T${session.start_time}`);
    const now          = new Date();
    const diffMinutes  = (now - sessionStart) / 60000;
    const status       = diffMinutes > 15 ? "late" : "present";

    if (existingRes.rows.length === 0) {
      // Student enrolled after the session was created, so no seeded row exists yet.
      await db.execute({
        sql: `INSERT INTO attendance_records (session_id, student_id, status, scanned_at, gps_lat, gps_lng, ip_address, device_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [session.id, req.user.studentId, status, now.toISOString(), gps_lat ?? null, gps_lng ?? null, ip_address ?? null, device_id ?? null],
      });
    } else {
      await db.execute({
        sql: `UPDATE attendance_records SET status = ?, scanned_at = ?, gps_lat = ?, gps_lng = ?, ip_address = ?, device_id = ?
              WHERE session_id = ? AND student_id = ?`,
        args: [status, now.toISOString(), gps_lat ?? null, gps_lng ?? null, ip_address ?? null, device_id ?? null, session.id, req.user.studentId],
      });
    }

    await db.execute({ sql: "UPDATE users SET last_active = ? WHERE id = ?", args: [now.toISOString(), req.user.id] });

    // Notify lecturer
    try {
      const courseRes    = await db.execute({ sql: "SELECT * FROM courses WHERE id = ?", args: [session.course_id] });
      const course       = courseRes.rows[0];
      const lecturerRes  = await db.execute({ sql: "SELECT user_id FROM lecturers WHERE id = ?", args: [course.lecturer_id] });
      const lecturerUser = lecturerRes.rows[0];
      const countRes     = await db.execute({
        sql: "SELECT COUNT(*) as cnt FROM attendance_records WHERE session_id = ? AND status IN ('present','late')",
        args: [session.id],
      });
      const enrolled = await db.execute({ sql: "SELECT COUNT(*) as cnt FROM enrolments WHERE course_id = ?", args: [session.course_id] });
      const studentRes = await db.execute({ sql: "SELECT name FROM users WHERE id = ?", args: [req.user.id] });

      notifyLecturerScan(
        lecturerUser.user_id,
        studentRes.rows[0].name,
        course.name,
        countRes.rows[0].cnt,
        enrolled.rows[0].cnt
      ).catch(console.error);
    } catch (err) { console.error("Lecturer notification error:", err); }

    res.json({ message: "Attendance marked successfully!", status });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark attendance." });
  }
});

app.get("/api/attendance/session/:id", authenticate, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT ar.*, u.name as student_name, st.index_number FROM attendance_records ar
            JOIN students st ON st.id = ar.student_id JOIN users u ON u.id = st.user_id
            WHERE ar.session_id = ? ORDER BY ar.scanned_at ASC`,
      args: [req.params.id],
    });
    res.json(plains(result.rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to load attendance records." });
  }
});

app.get("/api/attendance/student", authenticate, async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Access denied." });
  try {
    const result = await db.execute({
      sql: `SELECT ar.*, s.date, s.start_time, s.room, c.name as course_name, c.code as course_code
            FROM attendance_records ar JOIN sessions s ON s.id = ar.session_id JOIN courses c ON c.id = s.course_id
            WHERE ar.student_id = ? ORDER BY s.date DESC, s.start_time DESC`,
      args: [req.user.studentId],
    });
    res.json(plains(result.rows));
  } catch (err) {
    res.status(500).json({ error: "Failed to load attendance history." });
  }
});

app.get("/api/attendance/course/:id", authenticate, async (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Access denied." });
  try {
    const sessionsRes = await db.execute({
      sql: `SELECT s.*,
              (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status IN ('present','late')) as present,
              (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status = 'absent') as absent
            FROM sessions s WHERE s.course_id = ? ORDER BY s.date DESC`,
      args: [req.params.id],
    });
    const studentsRes = await db.execute({
      sql: `SELECT u.name, st.index_number,
              COUNT(CASE WHEN ar.status IN ('present','late') THEN 1 END) as attended,
              COUNT(ar.id) as total
            FROM enrolments e JOIN students st ON st.id = e.student_id JOIN users u ON u.id = st.user_id
            LEFT JOIN attendance_records ar ON ar.student_id = e.student_id
              AND ar.session_id IN (SELECT id FROM sessions WHERE course_id = ?)
            WHERE e.course_id = ? GROUP BY e.student_id`,
      args: [req.params.id, req.params.id],
    });
    res.json({ sessions: plains(sessionsRes.rows), students: plains(studentsRes.rows) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load course attendance." });
  }
});

// ══════════════════════════════════════════════════════
//  EMAIL TEST + ADMIN ROUTES
// ══════════════════════════════════════════════════════

app.post("/api/test/email", async (req, res) => {
  const { to, name } = req.body;
  if (!to || !name) return res.status(400).json({ error: "to and name are required." });
  try {
    await sendWelcomeEmail(to, name, "student", "PS/ITC/TEST/001");
    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/enroll-all", async (req, res) => {
  try {
    const students = await db.execute({ sql: "SELECT id FROM students", args: [] });
    const courses  = await db.execute({ sql: "SELECT id FROM courses",  args: [] });
    const stmts    = [];
    for (const s of students.rows) for (const c of courses.rows) {
      stmts.push({ sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [s.id, c.id] });
    }
    if (stmts.length > 0) await db.batch(stmts, "write");
    res.json({ message: `Done — enrolled ${students.rows.length} students in ${courses.rows.length} courses.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════════════════
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ AttendUCC backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ Failed to initialize database:", err);
    process.exit(1);
  });
  