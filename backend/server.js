const { deactivateInactiveAccounts } = require("./deactivateJob");
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
} = require("./emailService");

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || "attenducc-secret-key-ucc-2025";

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

const plain  = (row)  => (row ? { ...row } : row);
const plains = (rows) => rows.map(plain);

// ── UCC Lecture Halls with GPS ──
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

// GET /api/halls
app.get("/api/halls", (req, res) => {
  const halls = Object.entries(LECTURE_HALLS).map(([name, data]) => ({ name, ...data }));
  res.json(halls);
});

// ══════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role, index_number, staff_id, level, dept, programme, courses } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  try {
    const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const userResult = await db.execute({
      sql: "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      args: [name, email, hashed, role],
    });
    const userId = userResult.lastInsertRowid;

    let identifier = "";

    if (role === "student") {
      if (!index_number) return res.status(400).json({ error: "Index number is required for students." });
      identifier = index_number;
      await db.execute({
        sql: "INSERT INTO students (user_id, index_number, level, programme) VALUES (?, ?, ?, ?)",
        args: [userId, index_number, level || "100", programme || "BSc. Information Technology & Computing"],
      });
      const newStudentRes = await db.execute({ sql: "SELECT id FROM students WHERE user_id = ?", args: [userId] });
      const newStudentId  = newStudentRes.rows[0].id;
      const allCoursesRes = await db.execute({ sql: "SELECT id FROM courses", args: [] });
      if (allCoursesRes.rows.length > 0) {
        await db.batch(
          allCoursesRes.rows.map(c => ({ sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [newStudentId, c.id] })),
          "write"
        );
      }
    }

    if (role === "lecturer") {
      if (!staff_id) return res.status(400).json({ error: "Staff ID is required for lecturers." });
      identifier = staff_id;
      const lecturerResult = await db.execute({
        sql: "INSERT INTO lecturers (user_id, staff_id, dept) VALUES (?, ?, ?)",
        args: [userId, staff_id, dept || "Computer Science & IT"],
      });
      const lecturerId = lecturerResult.lastInsertRowid;

      if (Array.isArray(courses) && courses.length > 0) {
        const validCourses = courses.filter(c => c.name && c.code);
        if (validCourses.length > 0) {
          await db.batch(
            validCourses.map(c => ({ sql: "INSERT OR IGNORE INTO courses (code, name, lecturer_id) VALUES (?, ?, ?)", args: [c.code.toUpperCase().trim(), c.name.trim(), lecturerId] })),
            "write"
          );
          const allStudentsRes = await db.execute({ sql: "SELECT id FROM students", args: [] });
          const newCoursesRes  = await db.execute({ sql: "SELECT id FROM courses WHERE lecturer_id = ?", args: [lecturerId] });
          if (allStudentsRes.rows.length > 0 && newCoursesRes.rows.length > 0) {
            const enrolStmts = [];
            for (const s of allStudentsRes.rows) {
              for (const c of newCoursesRes.rows) {
                enrolStmts.push({ sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [s.id, c.id] });
              }
            }
            await db.batch(enrolStmts, "write");
          }
        }
      }
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name, role, identifier).catch(console.error);

    res.json({ message: "Account created successfully. You can now log in." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password, role } = req.body;
  if (!identifier || !password || !role) return res.status(400).json({ error: "Please fill in all fields." });

  try {
    let userRes = await db.execute({ sql: "SELECT * FROM users WHERE email = ? AND role = ?", args: [identifier, role] });
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

    await db.execute({ sql: "UPDATE users SET last_active = ? WHERE id = ?", args: [new Date().toISOString(), user.id] });

    let profile = { id: user.id, name: user.name, email: user.email, role: user.role };

    if (role === "student") {
      const sr = await db.execute({ sql: "SELECT * FROM students WHERE user_id = ?", args: [user.id] });
      const s  = sr.rows[0];
      profile  = { ...profile, studentId: s.id, indexNumber: s.index_number, level: s.level, programme: s.programme };
    }
    if (role === "lecturer") {
      const lr = await db.execute({ sql: "SELECT * FROM lecturers WHERE user_id = ?", args: [user.id] });
      const l  = lr.rows[0];
      profile  = { ...profile, lecturerId: l.id, staffId: l.staff_id, dept: l.dept };
    }

    const token = jwt.sign(profile, SECRET, { expiresIn: "8h" });
    res.json({ token, user: profile });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const userRes = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    const user    = userRes.rows[0];

    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: "If an account with that email exists, a reset link has been sent." });

    const resetToken  = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.execute({
      sql: "UPDATE users SET reset_token = ?, reset_expiry = ? WHERE id = ?",
      args: [resetToken, resetExpiry, user.id],
    });

    await sendPasswordReset(user.email, user.name, resetToken);
    res.json({ message: "If an account with that email exists, a reset link has been sent." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process request." });
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and new password are required." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

  try {
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE reset_token = ? AND reset_expiry > ?",
      args: [token, new Date().toISOString()],
    });
    const user = userRes.rows[0];
    if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });

    const hashed = bcrypt.hashSync(password, 10);
    await db.execute({
      sql: "UPDATE users SET password = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?",
      args: [hashed, user.id],
    });

    res.json({ message: "Password reset successfully. You can now log in." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset password." });
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
              LEFT JOIN enrolments e ON e.course_id = c.id
              WHERE c.lecturer_id = ? GROUP BY c.id`,
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
      await db.batch(
        allStudentsRes.rows.map(s => ({ sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [s.id, result.lastInsertRowid] })),
        "write"
      );
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
    const hallData = LECTURE_HALLS[room] || {};

    const result = await db.execute({
      sql: "INSERT INTO sessions (course_id, room, date, start_time, status, hall_lat, hall_lng, hall_radius) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
      args: [course_id, room, today, new Date().toTimeString().slice(0, 5), hallData.lat || null, hallData.lng || null, hallData.radius || 100],
    });

    const sessionId   = Number(result.lastInsertRowid);
    const studentsRes = await db.execute({ sql: "SELECT student_id FROM enrolments WHERE course_id = ?", args: [course_id] });

    if (studentsRes.rows.length > 0) {
      await db.batch(
        studentsRes.rows.map(s => ({ sql: "INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'absent')", args: [sessionId, s.student_id] })),
        "write"
      );
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
    const token                  = `UCC-${sessionId}-${Date.now()}`;
    const expiry                 = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.execute({
      sql: "UPDATE sessions SET qr_token = ?, qr_expiry = ?, lecturer_lat = ?, lecturer_lng = ? WHERE id = ?",
      args: [token, expiry, lecturer_lat || null, lecturer_lng || null, sessionId],
    });

    // Schedule QR expiry alert for enrolled students (after 10 mins)
    const sessionRes = await db.execute({
      sql: `SELECT s.*, c.name as course_name, c.code as course_code FROM sessions s JOIN courses c ON c.id = s.course_id WHERE s.id = ?`,
      args: [sessionId],
    });
    const session = sessionRes.rows[0];

    if (session) {
      setTimeout(async () => {
        try {
          // Get students who have NOT yet scanned
          const absentRes = await db.execute({
            sql: `SELECT u.email, u.name FROM attendance_records ar
                  JOIN students st ON st.id = ar.student_id
                  JOIN users u ON u.id = st.user_id
                  WHERE ar.session_id = ? AND ar.status = 'absent'`,
            args: [sessionId],
          });
          for (const student of absentRes.rows) {
            sendQRExpiryAlert(student.email, student.name, session.course_name, session.course_code).catch(console.error);
          }
        } catch (err) {
          console.error("QR expiry alert error:", err);
        }
      }, 10 * 60 * 1000); // fire after 10 minutes
    }

    res.json({ token, expiry, qrValue: `https://attend-ucc.app/scan/${token}`, locationCaptured: !!(lecturer_lat && lecturer_lng) });
  } catch (err) {
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

    // Send missed session alerts to absent students
    const sessionId  = req.params.id;
    const sessionRes = await db.execute({
      sql: `SELECT s.*, c.name as course_name, c.code as course_code, c.id as cid
            FROM sessions s JOIN courses c ON c.id = s.course_id WHERE s.id = ?`,
      args: [sessionId],
    });
    const session = sessionRes.rows[0];

    if (session) {
      // Get absent students with their current attendance rate
      const absentRes = await db.execute({
        sql: `SELECT u.email, u.name, st.id as student_id FROM attendance_records ar
              JOIN students st ON st.id = ar.student_id
              JOIN users u ON u.id = st.user_id
              WHERE ar.session_id = ? AND ar.status = 'absent'`,
        args: [sessionId],
      });

      for (const student of absentRes.rows) {
        try {
          // Calculate current attendance rate for this course
          const rateRes = await db.execute({
            sql: `SELECT
                    COUNT(CASE WHEN ar.status IN ('present','late') THEN 1 END) as attended,
                    COUNT(ar.id) as total
                  FROM attendance_records ar
                  JOIN sessions s ON s.id = ar.session_id
                  WHERE s.course_id = ? AND ar.student_id = ? AND s.status = 'ended'`,
            args: [session.cid, student.student_id],
          });
          const rate = rateRes.rows[0];
          const pct  = rate.total > 0 ? Math.round((rate.attended / rate.total) * 100) : 0;

          sendMissedSessionAlert(
            student.email, student.name,
            session.course_name, session.course_code,
            session.date, pct
          ).catch(console.error);
        } catch (err) {
          console.error("Missed session alert error:", err);
        }
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
    const { qr_token, gps_lat, gps_lng, ip_address } = req.body;

    const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE qr_token = ?", args: [qr_token] });
    const session    = sessionRes.rows[0];
    if (!session) return res.status(400).json({ error: "Invalid QR code. Please scan the correct code." });

    if (new Date() > new Date(session.qr_expiry)) return res.status(400).json({ error: "This QR code has expired. Ask your lecturer to generate a new one." });
    if (session.status !== "active") return res.status(400).json({ error: "This session has already ended." });

    const enrolmentRes = await db.execute({ sql: "SELECT * FROM enrolments WHERE student_id = ? AND course_id = ?", args: [req.user.studentId, session.course_id] });
    if (enrolmentRes.rows.length === 0) return res.status(403).json({ error: "You are not enrolled in this course." });

    const existingRes = await db.execute({ sql: "SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?", args: [session.id, req.user.studentId] });
    if (existingRes.rows[0]?.status === "present") return res.status(400).json({ error: "You have already marked attendance for this session." });

    if (ip_address) {
      const ipUsedRes = await db.execute({
        sql: "SELECT * FROM attendance_records WHERE session_id = ? AND ip_address = ? AND status IN ('present','late') AND student_id != ?",
        args: [session.id, ip_address, req.user.studentId],
      });
      if (ipUsedRes.rows.length > 0) return res.status(400).json({ error: "This device has already been used to mark attendance for another student. Proxy attendance is not allowed." });
    }

    // GPS check
    const refLat = session.lecturer_lat || session.hall_lat;
    const refLng = session.lecturer_lng || session.hall_lng;
    const radius = session.hall_radius  || 100;

    if (refLat && refLng && gps_lat && gps_lng) {
      const distance = getDistanceMetres(parseFloat(gps_lat), parseFloat(gps_lng), parseFloat(refLat), parseFloat(refLng));
      if (distance > radius) {
        return res.status(400).json({ error: `You are ${Math.round(distance)}m away from the classroom. Must be within ${radius}m.` });
      }
    }

    const sessionStart = new Date(`${session.date}T${session.start_time}`);
    const now          = new Date();
    const diffMinutes  = (now - sessionStart) / 60000;
    const status       = diffMinutes > 15 ? "late" : "present";

    await db.execute({
      sql: `UPDATE attendance_records SET status = ?, scanned_at = ?, gps_lat = ?, gps_lng = ?, ip_address = ?
            WHERE session_id = ? AND student_id = ?`,
      args: [status, now.toISOString(), gps_lat ?? null, gps_lng ?? null, ip_address ?? null, session.id, req.user.studentId],
    });

    await db.execute({ sql: "UPDATE users SET last_active = ? WHERE id = ?", args: [now.toISOString(), req.user.id] });

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
//  EMAIL TEST ROUTE
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

// ══════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/admin/enroll-all", async (req, res) => {
  try {
    const students = await db.execute({ sql: "SELECT id FROM students", args: [] });
    const courses  = await db.execute({ sql: "SELECT id FROM courses",  args: [] });
    const stmts    = [];
    for (const s of students.rows) {
      for (const c of courses.rows) {
        stmts.push({ sql: "INSERT OR IGNORE INTO enrolments (student_id, course_id) VALUES (?, ?)", args: [s.id, c.id] });
      }
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
