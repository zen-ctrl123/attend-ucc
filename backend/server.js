const express    = require("express");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const { db, initDatabase } = require("./database");

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || "attenducc-secret-key-ucc-2025";

// ── Middleware ─────────────────────────────────────────
app.use(cors());
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

// small helper: turn libsql Row objects into plain objects for res.json
const plain  = (row)  => (row ? { ...row } : row);
const plains = (rows) => rows.map(plain);

// ══════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role, index_number, staff_id, level, dept, programme } = req.body;

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

    if (role === "student") {
      if (!index_number) return res.status(400).json({ error: "Index number is required for students." });
      await db.execute({
        sql: "INSERT INTO students (user_id, index_number, level, programme) VALUES (?, ?, ?, ?)",
        args: [userId, index_number, level || "100", programme || "BSc. Information Technology & Computing"],
      });
    }

    if (role === "lecturer") {
      if (!staff_id) return res.status(400).json({ error: "Staff ID is required for lecturers." });
      await db.execute({
        sql: "INSERT INTO lecturers (user_id, staff_id, dept) VALUES (?, ?, ?)",
        args: [userId, staff_id, dept || "Computer Science & IT"],
      });
    }

    res.json({ message: "Account created successfully. You can now log in." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !password || !role) {
    return res.status(400).json({ error: "Please fill in all fields." });
  }

  try {
    let userRes = await db.execute({
      sql: "SELECT * FROM users WHERE email = ? AND role = ?",
      args: [identifier, role],
    });
    let user = userRes.rows[0];

    if (!user) {
      if (role === "student") {
        const studentRes = await db.execute({
          sql: "SELECT * FROM students WHERE index_number = ?",
          args: [identifier],
        });
        const student = studentRes.rows[0];
        if (student) {
          const uRes = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [student.user_id] });
          user = uRes.rows[0];
        }
      }
      if (role === "lecturer") {
        const lecturerRes = await db.execute({
          sql: "SELECT * FROM lecturers WHERE staff_id = ?",
          args: [identifier],
        });
        const lecturer = lecturerRes.rows[0];
        if (lecturer) {
          const uRes = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [lecturer.user_id] });
          user = uRes.rows[0];
        }
      }
    }

    if (!user) return res.status(401).json({ error: "Account not found. Check your ID and role." });
    if (user.role !== role) return res.status(401).json({ error: "Incorrect role selected." });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password." });

    let profile = { id: user.id, name: user.name, email: user.email, role: user.role };

    if (role === "student") {
      const stRes = await db.execute({ sql: "SELECT * FROM students WHERE user_id = ?", args: [user.id] });
      const student = stRes.rows[0];
      profile = { ...profile, studentId: student.id, indexNumber: student.index_number, level: student.level, programme: student.programme };
    }

    if (role === "lecturer") {
      const lRes = await db.execute({ sql: "SELECT * FROM lecturers WHERE user_id = ?", args: [user.id] });
      const lecturer = lRes.rows[0];
      profile = { ...profile, lecturerId: lecturer.id, staffId: lecturer.staff_id, dept: lecturer.dept };
    }

    const token = jwt.sign(profile, SECRET, { expiresIn: "8h" });
    res.json({ token, user: profile });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ══════════════════════════════════════════════════════
//  COURSES ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/courses", authenticate, async (req, res) => {
  try {
    if (req.user.role === "lecturer") {
      const result = await db.execute({
        sql: `
          SELECT c.*, COUNT(e.student_id) as enrolled
          FROM courses c
          LEFT JOIN enrolments e ON e.course_id = c.id
          WHERE c.lecturer_id = ?
          GROUP BY c.id
        `,
        args: [req.user.lecturerId],
      });
      return res.json(plains(result.rows));
    }

    if (req.user.role === "student") {
      const result = await db.execute({
        sql: `
          SELECT c.*,
            (SELECT COUNT(*) FROM sessions s WHERE s.course_id = c.id AND s.status = 'ended') as total_sessions,
            (SELECT COUNT(*) FROM attendance_records ar
              JOIN sessions s ON s.id = ar.session_id
              WHERE s.course_id = c.id AND ar.student_id = ? AND ar.status IN ('present','late')) as attended
          FROM courses c
          JOIN enrolments e ON e.course_id = c.id
          WHERE e.student_id = ?
        `,
        args: [req.user.studentId, req.user.studentId],
      });
      return res.json(plains(result.rows));
    }

    res.status(403).json({ error: "Access denied." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load courses." });
  }
});

// ══════════════════════════════════════════════════════
//  SESSIONS ROUTES
// ══════════════════════════════════════════════════════

app.get("/api/sessions/today", authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const result = await db.execute({
      sql: `
        SELECT s.*, c.name as course_name, c.code as course_code,
          COUNT(e.student_id) as enrolled,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status IN ('present','late')) as present
        FROM sessions s
        JOIN courses c ON c.id = s.course_id
        LEFT JOIN enrolments e ON e.course_id = c.id
        WHERE c.lecturer_id = ? AND s.date = ?
        GROUP BY s.id
      `,
      args: [req.user.lecturerId, today],
    });
    res.json(plains(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load sessions." });
  }
});

app.post("/api/sessions", authenticate, async (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Only lecturers can create sessions." });

  try {
    const { course_id, room } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const result = await db.execute({
      sql: "INSERT INTO sessions (course_id, room, date, start_time, status) VALUES (?, ?, ?, ?, 'active')",
      args: [course_id, room, today, new Date().toTimeString().slice(0, 5)],
    });

    const sessionId = result.lastInsertRowid;

    const studentsRes = await db.execute({
      sql: "SELECT student_id FROM enrolments WHERE course_id = ?",
      args: [course_id],
    });

    if (studentsRes.rows.length > 0) {
      const batchStatements = studentsRes.rows.map((s) => ({
        sql: "INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'absent')",
        args: [sessionId, s.student_id],
      }));
      await db.batch(batchStatements, "write");
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
    const sessionId = req.params.id;
    const token      = `UCC-${sessionId}-${Date.now()}`;
    const expiry     = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.execute({
      sql: "UPDATE sessions SET qr_token = ?, qr_expiry = ? WHERE id = ?",
      args: [token, expiry, sessionId],
    });

    res.json({ token, expiry, qrValue: `https://attend-ucc.app/scan/${token}` });
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
    res.json({ message: "Session ended." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to end session." });
  }
});

// ══════════════════════════════════════════════════════
//  ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════

// POST /api/attendance/scan — student marks attendance
app.post("/api/attendance/scan", authenticate, async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Only students can scan QR codes." });

  try {
    const { qr_token, gps_lat, gps_lng, ip_address } = req.body;

    const sessionRes = await db.execute({ sql: "SELECT * FROM sessions WHERE qr_token = ?", args: [qr_token] });
    const session = sessionRes.rows[0];
    if (!session) return res.status(400).json({ error: "Invalid QR code. Please scan the correct code." });

    if (new Date() > new Date(session.qr_expiry)) {
      return res.status(400).json({ error: "This QR code has expired. Ask your lecturer to generate a new one." });
    }

    if (session.status !== "active") {
      return res.status(400).json({ error: "This session has already ended." });
    }

    const enrolmentRes = await db.execute({
      sql: "SELECT * FROM enrolments WHERE student_id = ? AND course_id = ?",
      args: [req.user.studentId, session.course_id],
    });
    if (enrolmentRes.rows.length === 0) return res.status(403).json({ error: "You are not enrolled in this course." });

    const existingRes = await db.execute({
      sql: "SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?",
      args: [session.id, req.user.studentId],
    });
    const existing = existingRes.rows[0];

    if (existing && existing.status === "present") {
      return res.status(400).json({ error: "You have already marked attendance for this session." });
    }

    if (ip_address) {
      const ipUsedRes = await db.execute({
        sql: "SELECT * FROM attendance_records WHERE session_id = ? AND ip_address = ? AND status IN ('present', 'late') AND student_id != ?",
        args: [session.id, ip_address, req.user.studentId],
      });
      if (ipUsedRes.rows.length > 0) {
        return res.status(400).json({
          error: "This device has already been used to mark attendance for another student in this session. Proxy attendance is not allowed."
        });
      }
    }

    const sessionStart = new Date(`${session.date}T${session.start_time}`);
    const now          = new Date();
    const diffMinutes  = (now - sessionStart) / 60000;
    const status       = diffMinutes > 15 ? "late" : "present";

    await db.execute({
      sql: `
        UPDATE attendance_records
        SET status = ?, scanned_at = ?, gps_lat = ?, gps_lng = ?, ip_address = ?
        WHERE session_id = ? AND student_id = ?
      `,
      args: [status, now.toISOString(), gps_lat ?? null, gps_lng ?? null, ip_address ?? null, session.id, req.user.studentId],
    });

    res.json({ message: "Attendance marked successfully!", status });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark attendance." });
  }
});

// GET /api/attendance/session/:id
app.get("/api/attendance/session/:id", authenticate, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `
        SELECT ar.*, u.name as student_name, st.index_number
        FROM attendance_records ar
        JOIN students st ON st.id = ar.student_id
        JOIN users u ON u.id = st.user_id
        WHERE ar.session_id = ?
        ORDER BY ar.scanned_at ASC
      `,
      args: [req.params.id],
    });
    res.json(plains(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load attendance records." });
  }
});

// GET /api/attendance/student
app.get("/api/attendance/student", authenticate, async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Access denied." });

  try {
    const result = await db.execute({
      sql: `
        SELECT ar.*, s.date, s.start_time, s.room,
               c.name as course_name, c.code as course_code
        FROM attendance_records ar
        JOIN sessions s ON s.id = ar.session_id
        JOIN courses c  ON c.id = s.course_id
        WHERE ar.student_id = ?
        ORDER BY s.date DESC, s.start_time DESC
      `,
      args: [req.user.studentId],
    });
    res.json(plains(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load attendance history." });
  }
});

// GET /api/attendance/course/:id
app.get("/api/attendance/course/:id", authenticate, async (req, res) => {
  if (req.user.role !== "lecturer") return res.status(403).json({ error: "Access denied." });

  try {
    const sessionsRes = await db.execute({
      sql: `
        SELECT s.*,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status IN ('present','late')) as present,
          (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status = 'absent') as absent
        FROM sessions s
        WHERE s.course_id = ?
        ORDER BY s.date DESC
      `,
      args: [req.params.id],
    });

    const studentsRes = await db.execute({
      sql: `
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
      `,
      args: [req.params.id, req.params.id],
    });

    res.json({ sessions: plains(sessionsRes.rows), students: plains(studentsRes.rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load course attendance." });
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
  .catch((err) => {
    console.error("❌ Failed to initialize database:", err);
    process.exit(1);
  });
