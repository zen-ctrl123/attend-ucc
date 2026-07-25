import { useState } from "react";
import styles from "./Dashboard.module.css";
const COURSES = [
  { id: 1, code: "ITC 101", name: "Introduction to Programming",   enrolled: 42, sessions: 12 },
  { id: 2, code: "ITC 203", name: "Data Structures & Algorithms",  enrolled: 36, sessions: 12 },
  { id: 3, code: "ITC 305", name: "Web Technologies",              enrolled: 29, sessions: 12 },
  { id: 4, code: "ITC 207", name: "Database Management Systems",   enrolled: 40, sessions: 12 },
];
const SESSION_RECORDS = {
  "ITC 101": [
    { date: "Tue 1 Apr",  present: 40, absent: 2  },
    { date: "Thu 3 Apr",  present: 38, absent: 4  },
    { date: "Tue 8 Apr",  present: 42, absent: 0  },
    { date: "Thu 10 Apr", present: 39, absent: 3  },
    { date: "Tue 15 Apr", present: 41, absent: 1  },
    { date: "Thu 17 Apr", present: 38, absent: 4  },
    { date: "Tue 22 Apr", present: 37, absent: 5  },
    { date: "Thu 24 Apr", present: 40, absent: 2  },
    { date: "Tue 29 Apr", present: 36, absent: 6  },
    { date: "Thu 1 May",  present: 42, absent: 0  },
    { date: "Tue 6 May",  present: 39, absent: 3  },
    { date: "Thu 8 May",  present: 38, absent: 4  },
  ],
  "ITC 203": [
    { date: "Mon 31 Mar", present: 34, absent: 2 },
    { date: "Wed 2 Apr",  present: 30, absent: 6 },
    { date: "Mon 7 Apr",  present: 35, absent: 1 },
    { date: "Wed 9 Apr",  present: 32, absent: 4 },
    { date: "Mon 14 Apr", present: 33, absent: 3 },
    { date: "Wed 16 Apr", present: 36, absent: 0 },
    { date: "Mon 21 Apr", present: 29, absent: 7 },
    { date: "Wed 23 Apr", present: 31, absent: 5 },
    { date: "Mon 28 Apr", present: 34, absent: 2 },
    { date: "Wed 30 Apr", present: 33, absent: 3 },
    { date: "Mon 5 May",  present: 35, absent: 1 },
    { date: "Wed 7 May",  present: 30, absent: 6 },
  ],
  "ITC 305": [
    { date: "Tue 1 Apr",  present: 28, absent: 1 },
    { date: "Thu 3 Apr",  present: 25, absent: 4 },
    { date: "Tue 8 Apr",  present: 27, absent: 2 },
    { date: "Thu 10 Apr", present: 24, absent: 5 },
    { date: "Tue 15 Apr", present: 29, absent: 0 },
    { date: "Thu 17 Apr", present: 22, absent: 7 },
    { date: "Tue 22 Apr", present: 26, absent: 3 },
    { date: "Thu 24 Apr", present: 23, absent: 6 },
    { date: "Tue 29 Apr", present: 27, absent: 2 },
    { date: "Thu 1 May",  present: 25, absent: 4 },
    { date: "Tue 6 May",  present: 28, absent: 1 },
    { date: "Thu 8 May",  present: 24, absent: 5 },
  ],
  "ITC 207": [
    { date: "Mon 31 Mar", present: 38, absent: 2 },
    { date: "Wed 2 Apr",  present: 35, absent: 5 },
    { date: "Mon 7 Apr",  present: 40, absent: 0 },
    { date: "Wed 9 Apr",  present: 37, absent: 3 },
    { date: "Mon 14 Apr", present: 36, absent: 4 },
    { date: "Wed 16 Apr", present: 39, absent: 1 },
    { date: "Mon 21 Apr", present: 33, absent: 7 },
    { date: "Wed 23 Apr", present: 38, absent: 2 },
    { date: "Mon 28 Apr", present: 35, absent: 5 },
    { date: "Wed 30 Apr", present: 40, absent: 0 },
    { date: "Mon 5 May",  present: 37, absent: 3 },
    { date: "Wed 7 May",  present: 35, absent: 5 },
  ],
};
const STUDENT_RECORDS = [
  { id: "PS/ITC/22/0001", name: "Ama Asante",       attended: 11, total: 12, risk: false },
  { id: "PS/ITC/22/0008", name: "Kwame Boateng",    attended: 10, total: 12, risk: false },
  { id: "PS/ITC/22/0014", name: "Efua Mensah",      attended:  8, total: 12, risk: false },
  { id: "PS/ITC/22/0019", name: "Kofi Darkwa",      attended:  7, total: 12, risk: true  },
  { id: "PS/ITC/22/0027", name: "Abena Owusu",      attended: 12, total: 12, risk: false },
  { id: "PS/ITC/22/0033", name: "Yaw Frimpong",     attended:  9, total: 12, risk: false },
  { id: "PS/ITC/22/0041", name: "Akosua Sarpong",   attended:  6, total: 12, risk: true  },
  { id: "PS/ITC/22/0055", name: "Nana Adjei",       attended: 11, total: 12, risk: false },
  { id: "PS/ITC/22/0062", name: "Esi Quaye",        attended:  8, total: 12, risk: false },
  { id: "PS/ITC/22/0078", name: "Kwabena Ofori",    attended:  5, total: 12, risk: true  },
];
function downloadCSV(filename, rows) {
  const csv     = rows.map(r => r.join(",")).join("\n");
  const blob    = new Blob([csv], { type: "text/csv" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = url;
  a.download    = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSessionCSV(course, records) {
  const header = ["Date", "Course Code", "Course Name", "Present", "Absent", "Rate (%)"];
  const rows   = records.map(r => [
    r.date, course.code, `"${course.name}"`,
    r.present, r.absent,
    Math.round(r.present / course.enrolled * 100),
  ]);
  downloadCSV(`${course.code}_sessions.csv`, [header, ...rows]);
}

function exportStudentCSV(course, students) {
  const header = ["Index Number", "Student Name", "Attended", "Total Sessions", "Rate (%)", "Status"];
  const rows   = students.map(s => [
    s.id, `"${s.name}"`, s.attended, s.total,
    Math.round(s.attended / s.total * 100),
    s.risk ? "AT RISK" : "OK",
  ]);
  downloadCSV(`${course.code}_students.csv`, [header, ...rows]);
}

function exportFullReportCSV(courses) {
  const header = ["Course Code", "Course Name", "Enrolled", "Total Sessions", "Avg Attendance (%)", "At Risk Students"];
  const rows   = courses.map(c => {
    const recs = SESSION_RECORDS[c.code] || [];
    const avg  = recs.length
      ? Math.round(recs.reduce((a, r) => a + Math.round(r.present / c.enrolled * 100), 0) / recs.length)
      : 0;
    return [c.code, `"${c.name}"`, c.enrolled, c.sessions, avg, STUDENT_RECORDS.filter(s => s.risk).length];
  });
  downloadCSV("AttendUCC_Full_Report.csv", [header, ...rows]);
}
function AttendanceChart({ records, enrolled }) {
  const max = enrolled;
  const w   = 520;
  const h   = 120;
  const pad = { top: 10, right: 10, bottom: 28, left: 32 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const barW   = Math.max(8, Math.floor(innerW / records.length) - 4);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: w, display: "block" }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = pad.top + innerH - (pct / 100) * innerH;
        return (
          <g key={pct}>
            <line x1={pad.left} x2={pad.left + innerW} y1={y} y2={y}
              stroke="#e8eaf0" strokeWidth="1" />
            <text x={pad.left - 4} y={y + 4} fontSize="8" fill="#aaa" textAnchor="end">{pct}%</text>
          </g>
        );
      })}

      {/* 75% threshold line */}
      {(() => {
        const y = pad.top + innerH - 0.75 * innerH;
        return (
          <line x1={pad.left} x2={pad.left + innerW} y1={y} y2={y}
            stroke="#C9A84C" strokeWidth="1" strokeDasharray="4 3" />
        );
      })()}

      {/* Bars */}
      {records.map((r, i) => {
        const pct    = r.present / max;
        const barH   = Math.max(2, pct * innerH);
        const x      = pad.left + i * (innerW / records.length) + (innerW / records.length - barW) / 2;
        const y      = pad.top + innerH - barH;
        const color  = pct < 0.75 ? "#8B0000" : pct < 0.85 ? "#C9A84C" : "#1a7a4a";
        // Short date label (first word)
        const label  = r.date.split(" ").slice(0, 2).join(" ");
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="2" fill={color} opacity="0.85" />
            <text
              x={x + barW / 2} y={h - 4}
              fontSize="6.5" fill="#aaa" textAnchor="middle"
              transform={`rotate(-35, ${x + barW / 2}, ${h - 4})`}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
export default function ReportsTab() {
  const [view, setView]             = useState("overview");   // overview | course
  const [selectedCourse, setSelected] = useState(COURSES[0]);
  const [studentFilter, setFilter]  = useState("all");        // all | risk

  const records = SESSION_RECORDS[selectedCourse.code] || [];
  const avgRate = records.length
    ? Math.round(records.reduce((a, r) => a + Math.round(r.present / selectedCourse.enrolled * 100), 0) / records.length)
    : 0;

  const filteredStudents = studentFilter === "risk"
    ? STUDENT_RECORDS.filter(s => s.risk)
    : STUDENT_RECORDS;
  if (view === "overview") {
    return (
      <div className={styles.content}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionTitle}>Attendance Reports</div>
            <div className={styles.sectionSub}>Semester overview — all courses</div>
          </div>
          <button className={styles.btnPrimary} onClick={() => exportFullReportCSV(COURSES)}>
            ⬇ Export Full Report
          </button>
        </div>

        {/* Summary stats */}
        <div className={styles.statsRow}>
          {[
            { val: COURSES.length,                                                         label: "Courses",          cls: ""        },
            { val: COURSES.reduce((a, c) => a + c.enrolled, 0),                           label: "Total Students",   cls: "gold"    },
            { val: `${Math.round(Object.values(SESSION_RECORDS).flatMap(r => r).reduce((a, r, _, arr) => a + r.present / (r.present + r.absent) * 100 / arr.length, 0))}%`,
                                                                                           label: "Avg Attendance",   cls: "green"   },
            { val: STUDENT_RECORDS.filter(s => s.risk).length,                            label: "Students At Risk", cls: "red"     },
          ].map(s => (
            <div key={s.label} className={`${styles.statCard} ${s.cls ? styles[s.cls] : ""}`}>
              <div className={styles.statVal}>{s.val}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Per-course summary table */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>📊 Course Summary</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Course</th>
                <th>Code</th>
                <th>Enrolled</th>
                <th>Avg Attendance</th>
                <th>Trend</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {COURSES.map(c => {
                const recs = SESSION_RECORDS[c.code] || [];
                const avg  = recs.length
                  ? Math.round(recs.reduce((a, r) => a + Math.round(r.present / c.enrolled * 100), 0) / recs.length)
                  : 0;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><code style={{ background: "#f0f2f5", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{c.code}</code></td>
                    <td>{c.enrolled}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
                        <div className={styles.progressTrack} style={{ flex: 1 }}>
                          <div
                            className={`${styles.progressFill} ${avg < 70 ? styles.red : avg < 85 ? styles.gold : styles.green}`}
                            style={{ width: `${avg}%` }}
                          />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: avg < 75 ? "#8B0000" : "#003366", whiteSpace: "nowrap" }}>
                          {avg}%
                        </span>
                      </div>
                    </td>
                    <td style={{ width: 120 }}>
                      <AttendanceChart records={recs.slice(-6)} enrolled={c.enrolled} />
                    </td>
                    <td>
                      <button className={styles.btnSecondary}
                        style={{ padding: "6px 14px", fontSize: 12 }}
                        onClick={() => { setSelected(c); setView("course"); }}>
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.content}>
      <div className={styles.sectionHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className={styles.btnSecondary}
            style={{ padding: "7px 14px", fontSize: 12 }}
            onClick={() => setView("overview")}>
            ← Back
          </button>
          <div>
            <div className={styles.sectionTitle}>{selectedCourse.name}</div>
            <div className={styles.sectionSub}>{selectedCourse.code} · {selectedCourse.enrolled} students enrolled</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={styles.btnSecondary}
            onClick={() => exportSessionCSV(selectedCourse, records)}>
            ⬇ Sessions CSV
          </button>
          <button className={styles.btnPrimary}
            onClick={() => exportStudentCSV(selectedCourse, STUDENT_RECORDS)}>
            ⬇ Students CSV
          </button>
        </div>
      </div>

      {/* Course stats */}
      <div className={styles.statsRow}>
        {[
          { val: `${avgRate}%`,                                          label: "Avg Rate",        cls: ""      },
          { val: selectedCourse.sessions,                                label: "Sessions Held",   cls: "gold"  },
          { val: STUDENT_RECORDS.filter(s => !s.risk).length,           label: "On Track",        cls: "green" },
          { val: STUDENT_RECORDS.filter(s =>  s.risk).length,           label: "At Risk (< 75%)", cls: "red"   },
        ].map(s => (
          <div key={s.label} className={`${styles.statCard} ${s.cls ? styles[s.cls] : ""}`}>
            <div className={styles.statVal}>{s.val}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance chart */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>📈 Attendance Over Time</div>
        <div style={{ marginBottom: 8 }}>
          <AttendanceChart records={records} enrolled={selectedCourse.enrolled} />
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#888", marginTop: 8 }}>
          <span>🟩 ≥ 85%</span>
          <span>🟨 75–84%</span>
          <span>🟥 &lt; 75%</span>
          <span style={{ color: "#C9A84C" }}>— — 75% threshold</span>
        </div>
      </div>

      {/* Per-session table */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>📋 Session-by-Session Records</div>
        <table className={styles.table}>
          <thead>
            <tr><th>Date</th><th>Present</th><th>Absent</th><th>Rate</th></tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const pct = Math.round(r.present / selectedCourse.enrolled * 100);
              return (
                <tr key={i}>
                  <td style={{ color: "#888" }}>{r.date}</td>
                  <td style={{ color: "#1a7a4a", fontWeight: 600 }}>{r.present}</td>
                  <td style={{ color: "#8B0000", fontWeight: 600 }}>{r.absent}</td>
                  <td>
                    <span className={`${styles.badge} ${pct >= 85 ? styles.badgePresent : pct >= 75 ? styles.badgeLate : styles.badgeAbsent}`}>
                      {pct}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-student table */}
      <div className={styles.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className={styles.cardTitle} style={{ margin: 0 }}>👥 Student Breakdown</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["all", "risk"].map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: studentFilter === f ? "#003366" : "transparent",
                  color:      studentFilter === f ? "#fff"    : "#003366",
                  border:     "1.5px solid #003366",
                  transition: "all 0.2s",
                }}>
                {f === "all" ? "All Students" : "⚠ At Risk Only"}
              </button>
            ))}
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Index Number</th><th>Name</th><th>Attended</th><th>Rate</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filteredStudents.map(s => {
              const pct = Math.round(s.attended / s.total * 100);
              return (
                <tr key={s.id}>
                  <td><code style={{ background: "#f0f2f5", padding: "2px 7px", borderRadius: 4, fontSize: 12 }}>{s.id}</code></td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ color: "#555" }}>{s.attended}/{s.total}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 120 }}>
                      <div className={styles.progressTrack} style={{ flex: 1 }}>
                        <div className={`${styles.progressFill} ${pct < 75 ? styles.red : styles.green}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: pct < 75 ? "#8B0000" : "#1a7a4a" }}>{pct}%</span>
                    </div>
                  </td>
                  <td>
                    {s.risk
                      ? <span className={`${styles.badge} ${styles.badgeAbsent}`}>At Risk</span>
                      : <span className={`${styles.badge} ${styles.badgePresent}`}>On Track</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
