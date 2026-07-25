const express    = require("express");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const db         = require("./database");

const app    = express();
const PORT   = 3001;
const SECRET = "attenducc-secret-key-ucc-2025";

// ── Middleware ─────────────────────────────────────────
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ── Auth Middleware ────────────────────────────────────
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

// ══════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════

// POST /api/auth/register
app.post("/api/auth/register", (req, res) => {
  const { name, email, password, role, index_number, staff_id, level, dept, programme } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(400).json({ error: "An account with this email already exists." });

  const hashed = bcrypt.hashSync(password, 10);

  try {
    const userResult = db.prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
    ).run(name, email, hashed, role);

    const userId = userResult.lastInsertRowid;

    if (role === "student") {
      if (!index_number) return res.status(400).json({ error: "Index number is required for students." });
      db.prepare(
        "INSERT INTO students (user_id, index_number, level, programme) VALUES (?, ?, ?, ?)"
      ).run(userId, index_number, level || "100", programme || "BSc. Information Technology & Computing");
    }

    if (role === "lecturer") {
      if (!staff_id) return res.status(400).json({ error: "Staff ID is required for lecturers." });
      db.prepare(
        "INSERT INTO lecturers (user_id, staff_id, dept) VALUES (?, ?, ?)"
      ).run(userId, staff_id, dept || "Computer Science & IT");
    }

    res.json({ message: "Account created successfully. You can now log in." });

  } catch (err) {
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", (req, res) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !password || !role) {
    return res.status(400).json({ error: "Please fill in all fields." });
  }

  let user = db.prepare("SELECT * FROM users WHERE email = ? AND role = ?").get(identifier, role);

  if (!user) {
    if (role === "student") {
      const student = db.prepare("SELECT * FROM students WHERE index_number = ?").get(identifier);
      if (student) user = db.prepare("SELECT * FROM users WHERE id = ?").get(student.user_id);
    }
    if (role === "lecturer") {
      const lecturer = db.prepare("SELECT * FROM lecturers WHERE staff_id = ?").get(identifier);
      if (lecturer) user = db.prepare("SELECT * FROM users WHERE id = ?").get(lecturer.user_id);
    }
  }

  if (!user) return res.status(401).json({ error: "Account not found. Check your ID and role." });
  if (user.role !== role) return res.status(401).json({ error: "Incorrect role selected." });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: "Incorrect password." });

  let profile = { id: user.id, name: user.name, email: user.email, role: user.role };

  if (role === "student") {
    const student = db.prepare("SELECT * FROM students WHERE user_id = ?").get(user.id);
    profile = { ...profile, studentId: student.id, indexNumber: student.index_number, level: student.level, programme: student.programme };
  }

  if (role === "lecturer") {
    const lecturer = db.prepare("SELECT * FROM lecturers WHERE user_id = ?").get(user.id);
    profile = { ...profile, lecturerId: lecturer.id, staffId: lecturer.staff_id, dept: lecturer.dept };
  }

  const token = jwt.sign(profile, SECRET, { expiresIn: "8h" });
  res.json({ token, user: profile });
});

// ══════════════════════════════════════════════════════
//  COURSES ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/courses", authenticate, (req, res) => {
  if (req.user.role === "lecturer") {
    const courses = db.prepare(`
      SELECT c.*, COUNT(e.student_id) as enrolled
      FROM courses c
      LEFT JOIN enrolments e ON e.course_id = c.id
      WHERE c.lecturer_id = ?
      GROUP BY c.id
    `).all(req.user.lecturerId);
    return res.json(courses);
  }

  if (req.user.role === "student") {
    const courses = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id AND s.status = 'ended') as total_sessions,
        (SELECT COUNT(*) FROM attendance_records ar
          JOIN sessions s ON s.id = ar.session_id
          WHERE s.course_id = c.id AND ar.student_id = ? AND ar.status IN ('present','late')) as attended
      FROM courses c
      JOIN enrolments e ON e.course_id = c.id
      WHERE e.student_id = ?
    `).all(req.user.studentId, req.user.studentId);
    return res.json(courses);
  }
});

// ══════════════════════════════════════════════════════
//  SESSIONS ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/sessions/today", authenticate, (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const sessions = db.prepare(`
    SELECT s.*, c.name as course_name, c.code as course_code,
      COUNT(e.student_id) as enrolled,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status IN ('present','late')) as present
    FROM sessions s
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN enrolments e ON e.course_id = c.id
    WHERE c.lecturer_id = ? AND s.date = ?
    GROUP BY s.id
  `).all(req.user.lecturerId, today);
  res.json(sessions);
});

app.post("/api/sessions", authenticate, (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can create sessions." });

  const { course_id, room } = req.body;
  const today = new Date().toISOString().split("T")[0];

  const result = db.prepare(
    "INSERT INTO sessions (course_id, room, date, start_time, status) VALUES (?, ?, ?, ?, 'active')"
  ).run(course_id, room, today, new Date().toTimeString().slice(0, 5));

  const students = db.prepare("SELECT student_id FROM enrolments WHERE course_id = ?").all(course_id);
  const insertRecord = db.prepare(
    "INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'absent')"
  );
  for (const s of students) insertRecord.run(result.lastInsertRowid, s.student_id);

  res.json({ sessionId: result.lastInsertRowid, message: "Session created." });
});

app.post("/api/sessions/:id/qr", authenticate, (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can generate QR codes." });

  const sessionId = req.params.id;
  const token     = `UCC-${sessionId}-${Date.now()}`;
  const expiry    = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare("UPDATE sessions SET qr_token = ?, qr_expiry = ? WHERE id = ?").run(token, expiry, sessionId);

  res.json({ token, expiry, qrValue: `https://attend-ucc.app/scan/${token}` });
});

app.post("/api/sessions/:id/end", authenticate, (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can end sessions." });
  db.prepare("UPDATE sessions SET status = 'ended', end_time = ? WHERE id = ?")
    .run(new Date().toTimeString().slice(0, 5), req.params.id);
  res.json({ message: "Session ended." });
});

// ══════════════════════════════════════════════════════
//  ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════

// POST /api/attendance/scan — student marks attendance
app.post("/api/attendance/scan", authenticate, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Only students can scan QR codes." });

  const { qr_token, gps_lat, gps_lng, ip_address } = req.body;

  // Find the session by token
  const session = db.prepare("SELECT * FROM sessions WHERE qr_token = ?").get(qr_token);
  if (!session) return res.status(400).json({ error: "Invalid QR code. Please scan the correct code." });

  // Check if QR is expired
  if (new Date() > new Date(session.qr_expiry)) {
    return res.status(400).json({ error: "This QR code has expired. Ask your lecturer to generate a new one." });
  }

  // Check if session is still active
  if (session.status !== "active") {
    return res.status(400).json({ error: "This session has already ended." });
  }

  // Check if student is enrolled in this course
  const enrolment = db.prepare(
    "SELECT * FROM enrolments WHERE student_id = ? AND course_id = ?"
  ).get(req.user.studentId, session.course_id);
  if (!enrolment) return res.status(403).json({ error: "You are not enrolled in this course." });

  // Check if student already marked attendance
  const existing = db.prepare(
    "SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?"
  ).get(session.id, req.user.studentId);

  if (existing && existing.status === "present") {
    return res.status(400).json({ error: "You have already marked attendance for this session." });
  }

  // Check if this device IP has already been used for a different student in this session
  if (ip_address) {
    const ipAlreadyUsed = db.prepare(
      "SELECT * FROM attendance_records WHERE session_id = ? AND ip_address = ? AND status IN ('present', 'late') AND student_id != ?"
    ).get(session.id, ip_address, req.user.studentId);

    if (ipAlreadyUsed) {
      return res.status(400).json({
        error: "This device has already been used to mark attendance for another student in this session. Proxy attendance is not allowed."
      });
    }
  }

  // Determine if late (more than 15 minutes after session start)
  const sessionStart = new Date(`${session.date}T${session.start_time}`);
  const now          = new Date();
  const diffMinutes  = (now - sessionStart) / 60000;
  const status       = diffMinutes > 15 ? "late" : "present";

  // Update the attendance record
  db.prepare(`
    UPDATE attendance_records
    SET status = ?, scanned_at = ?, gps_lat = ?, gps_lng = ?, ip_address = ?
    WHERE session_id = ? AND student_id = ?
  `).run(status, now.toISOString(), gps_lat, gps_lng, ip_address, session.id, req.user.studentId);

  res.json({ message: "Attendance marked successfully!", status });
});

// GET /api/attendance/session/:id
app.get("/api/attendance/session/:id", authenticate, (req, res) => {
  const records = db.prepare(`
    SELECT ar.*, u.name as student_name, st.index_number
    FROM attendance_records ar
    JOIN students st ON st.id = ar.student_id
    JOIN users u ON u.id = st.user_id
    WHERE ar.session_id = ?
    ORDER BY ar.scanned_at ASC
  `).all(req.params.id);
  res.json(records);
});

// GET /api/attendance/student
app.get("/api/attendance/student", authenticate, (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Access denied." });

  const records = db.prepare(`
    SELECT ar.*, s.date, s.start_time, s.room,
           c.name as course_name, c.code as course_code
    FROM attendance_records ar
    JOIN sessions s ON s.id = ar.session_id
    JOIN courses c  ON c.id = s.course_id
    WHERE ar.student_id = ?
    ORDER BY s.date DESC, s.start_time DESC
  `).all(req.user.studentId);
  res.json(records);
});

// GET /api/attendance/course/:id
app.get("/api/attendance/course/:id", authenticate, (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Access denied." });

  const sessions = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status IN ('present','late')) as present,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status = 'absent') as absent
    FROM sessions s
    WHERE s.course_id = ?
    ORDER BY s.date DESC
  `).all(req.params.id);

  const students = db.prepare(`
    SELECT u.name, st.index_number,
      COUNT(CASE WHEN ar.status IN ('present','late') THEN 1 END) as attended,
      COUNT(ar.id) as total
    FROM enrolments e
    JOIN students st ON st.id = e.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN attendance_records ar ON ar.student_id = e.student_id
      AND ar.session_id IN (SELECT id FROM sessions WHERE course_id = ?)
    WHERE e.course_id = ?
    GROUP BY e.student_id
  `).all(req.params.id, req.params.id);

  res.json({ sessions, students });
});

// ══════════════════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`✅ AttendUCC backend running on http://localhost:${PORT}`);
});
