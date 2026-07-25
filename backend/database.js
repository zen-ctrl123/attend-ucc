const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "attenducc.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('lecturer', 'student')),
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER UNIQUE NOT NULL,
    index_number TEXT UNIQUE NOT NULL,
    level        TEXT NOT NULL,
    programme    TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS lecturers (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER UNIQUE NOT NULL,
    staff_id TEXT UNIQUE NOT NULL,
    dept     TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS courses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    lecturer_id INTEGER NOT NULL,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id)
  );

  CREATE TABLE IF NOT EXISTS enrolments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id  INTEGER NOT NULL,
    UNIQUE(student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id)  REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id   INTEGER NOT NULL,
    room        TEXT NOT NULL,
    date        TEXT NOT NULL,
    start_time  TEXT NOT NULL,
    end_time    TEXT,
    qr_token    TEXT UNIQUE,
    qr_expiry   TEXT,
    status      TEXT DEFAULT 'active' CHECK(status IN ('active', 'ended')),
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS attendance_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL,
    student_id  INTEGER NOT NULL,
    status      TEXT DEFAULT 'absent' CHECK(status IN ('present', 'late', 'absent')),
    scanned_at  TEXT,
    gps_lat     REAL,
    gps_lng     REAL,
    ip_address  TEXT,
    UNIQUE(session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`);

const bcrypt = require("bcryptjs");

function seedData() {
  const existingUsers = db.prepare("SELECT COUNT(*) as count FROM users").get();
  if (existingUsers.count > 0) return; // already seeded

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // Lecturer
  const lecturerUser = db.prepare(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
  ).run("Dr. Emmanuel Tetteh", "etetteh@ucc.edu.gh", hash("password123"), "lecturer");

  const lecturer = db.prepare(
    "INSERT INTO lecturers (user_id, staff_id, dept) VALUES (?, ?, ?)"
  ).run(lecturerUser.lastInsertRowid, "L001", "Computer Science & IT");

  // Students
  const studentData = [
    { name: "Bart Addison Stanley", email: "bstanley@ucc.edu.gh", index: "PS/ITC/22/0074" },
    { name: "Ama Asante",           email: "aasante@ucc.edu.gh",  index: "PS/ITC/22/0001" },
    { name: "Kwame Boateng",        email: "kboateng@ucc.edu.gh", index: "PS/ITC/22/0008" },
    { name: "Efua Mensah",          email: "emensah@ucc.edu.gh",  index: "PS/ITC/22/0014" },
    { name: "Kofi Darkwa",          email: "kdarkwa@ucc.edu.gh",  index: "PS/ITC/22/0019" },
  ];

  const studentIds = studentData.map((s) => {
    const u = db.prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
    ).run(s.name, s.email, hash("password123"), "student");

    const st = db.prepare(
      "INSERT INTO students (user_id, index_number, level, programme) VALUES (?, ?, ?, ?)"
    ).run(u.lastInsertRowid, s.index, "300", "BSc. Information Technology & Computing");

    return st.lastInsertRowid;
  });

  // Courses
  const courseData = [
    { code: "INF 101", name: "Introduction to Programming" },
    { code: "INF 203", name: "Data Structures & Algorithms" },
    { code: "INF 305", name: "Web Technologies" },
    { code: "INF 207", name: "Database Management Systems" },
  ];

  const courseIds = courseData.map((c) => {
    const res = db.prepare(
      "INSERT INTO courses (code, name, lecturer_id) VALUES (?, ?, ?)"
    ).run(c.code, c.name, lecturer.lastInsertRowid);
    return res.lastInsertRowid;
  });

  // Enrol all students in all courses
  for (const sid of studentIds) {
    for (const cid of courseIds) {
      db.prepare(
        "INSERT INTO enrolments (student_id, course_id) VALUES (?, ?)"
      ).run(sid, cid);
    }
  }

  console.log("✅ Database seeded with demo data");
}

seedData();

module.exports = db;