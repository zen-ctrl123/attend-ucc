import NotificationBell from "../../components/NotificationBell";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import ReportsTab from "./ReportsTab";
import {
  getCourses,
  getTodaySessions,
  createSession,
  generateQR,
  endSession,
  getSessionAttendance,
  getCourseReport,
} from "../api";
import styles from "./Dashboard.module.css";

function initials(name) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("");
}

/* ── GLOBAL TOP BAR (logo + brand + page title + date/notif) ── */
function GlobalTopBar({ title, onMenuClick }) {
  const today = new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarBrand}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Open menu">☰</button>
        <img src="/ucc-logo.png" alt="UCC" className={styles.topBarLogo}
          onError={e => e.target.style.display = "none"} />
        <div>
          <div className={styles.topBarBrandTitle}>AttendUCC</div>
          <div className={styles.topBarBrandSub}>Lecturer Portal</div>
        </div>
      </div>
      <div className={styles.topBarTitle}>{title}</div>
      <div className={styles.topBarRight}>
        <span className={styles.topBarDate}>📅 {today}</span>
        <NotificationBell />
      </div>
    </div>
  );
}

/* ── SIDEBAR ── */
function Sidebar({ active, setActive, logout, drawerOpen, closeDrawer }) {
  const navItems = [
    { key: "Dashboard",  icon: "🏠", label: "Dashboard"          },
    { key: "Sessions",   icon: "📱", label: "Sessions & QR Code"  },
    { key: "Records",    icon: "📋", label: "Attendance Records"  },
    { key: "Reports",    icon: "📊", label: "Reports"             },
    { key: "Profile",    icon: "👤", label: "Profile"             },
  ];

  const handleNavClick = (key) => {
    setActive(key);
    closeDrawer();
  };

  return (
    <>
      {drawerOpen && <div className={styles.drawerOverlay} onClick={closeDrawer} />}
      <aside className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}>
        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>Main Menu</div>
          {navItems.map(item => (
            <button key={item.key}
              className={`${styles.navItem} ${active === item.key ? styles.navItemActive : ""}`}
              onClick={() => handleNavClick(item.key)}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <button className={styles.logoutBtn} onClick={logout}>
            <span className={styles.navIcon}>🚪</span>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

/* ══════════════════════════════════════
   PAGE: DASHBOARD (HOME)
══════════════════════════════════════ */
function DashboardPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTodaySessions()
      .then(setSessions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.content}><div className={styles.emptyState}>Loading today's sessions…</div></div>;
  if (error)   return <div className={styles.content}><div className={`${styles.alertBanner} ${styles.danger}`}>⚠️ {error}</div></div>;

  const active        = sessions.filter(s => s.status === "active");
  const totalEnrolled = sessions.reduce((a, s) => a + (s.enrolled || 0), 0);
  const totalPresent  = sessions.reduce((a, s) => a + (s.present || 0), 0);

  return (
    <div className={styles.content}>

      {active.length > 0 && (
        <div className={styles.alertBanner}>
          🟢 <strong>{active.length} session{active.length !== 1 ? "s" : ""} in progress</strong> — students can currently scan attendance
        </div>
      )}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statVal}>{sessions.length}</div>
          <div className={styles.statLabel}>Today's Sessions</div>
        </div>
        <div className={`${styles.statCard} ${styles.gold}`}>
          <div className={styles.statVal}>{totalEnrolled}</div>
          <div className={styles.statLabel}>Total Enrolled</div>
        </div>
        <div className={`${styles.statCard} ${styles.green}`}>
          <div className={styles.statVal}>{totalPresent}</div>
          <div className={styles.statLabel}>Present Today</div>
        </div>
        <div className={`${styles.statCard} ${styles.red}`}>
          <div className={styles.statVal}>{totalEnrolled - totalPresent}</div>
          <div className={styles.statLabel}>Absent Today</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>📅 Today's Schedule</div>
        </div>
        {sessions.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            No sessions yet today. Go to "Sessions &amp; QR Code" to start one.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Course</th><th>Code</th><th>Room</th><th>Attendance</th><th>Status</th></tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.course_name}</td>
                  <td><code style={{ background: "#f0f2f5", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{s.course_code}</code></td>
                  <td>{s.room}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 140 }}>
                      <div className={styles.progressTrack} style={{ flex: 1 }}>
                        <div className={`${styles.progressFill} ${s.enrolled && s.present / s.enrolled < 0.7 ? styles.red : ""}`}
                          style={{ width: `${s.enrolled ? Math.round(s.present / s.enrolled * 100) : 0}%` }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#003366", whiteSpace: "nowrap" }}>
                        {s.present}/{s.enrolled}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${s.status === "active" ? styles.badgeActive : styles.badgeEnded}`}>
                      {s.status === "active" ? "🟢 Active" : "Ended"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: SESSIONS & QR
══════════════════════════════════════ */
function SessionsPage() {
  const [sessions, setSessions]     = useState([]);
  const [courses, setCourses]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [students, setStudents]     = useState([]);
  const [qrData, setQrData]         = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCourseId, setNewCourseId] = useState("");
  const [newRoom, setNewRoom]       = useState("");
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState("");

  const loadSessions = () => {
    setLoading(true);
    getTodaySessions()
      .then(data => {
        setSessions(data);
        setSelected(prev => {
          const stillThere = prev && data.find(s => s.id === prev.id);
          return stillThere || data[0] || null;
        });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
    getCourses().then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setStudents([]); return; }
    setQrData(null);
    getSessionAttendance(selected.id).then(setStudents).catch(() => setStudents([]));
  }, [selected?.id]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newCourseId || !newRoom.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createSession(Number(newCourseId), newRoom.trim());
      setShowNewForm(false);
      setNewCourseId("");
      setNewRoom("");
      loadSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!selected) return;
    try {
      const data = await generateQR(selected.id);
      setQrData(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEndSession = async () => {
    if (!selected) return;
    try {
      await endSession(selected.id);
      setQrData(null);
      loadSessions();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className={styles.content}><div className={styles.emptyState}>Loading sessions…</div></div>;

  const pct = selected && selected.enrolled ? Math.round(selected.present / selected.enrolled * 100) : 0;

  return (
    <div className={styles.content}>
      {error && (
        <div className={`${styles.alertBanner} ${styles.danger}`} style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <button className={styles.btnPrimary} onClick={() => setShowNewForm(v => !v)}>
          {showNewForm ? "Cancel" : "➕ New Session"}
        </button>
      </div>

      {showNewForm && (
        <div className={styles.card}>
          <div className={styles.cardTitle} style={{ marginBottom: 16 }}>Start a New Session</div>
          <form onSubmit={handleCreateSession} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#003366", textTransform: "uppercase", letterSpacing: "0.04em" }}>Course</label>
              <select value={newCourseId} onChange={e => setNewCourseId(e.target.value)}
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid #e0e4ea", borderRadius: 8, fontSize: 14 }} required>
                <option value="">Select a course…</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#003366", textTransform: "uppercase", letterSpacing: "0.04em" }}>Room</label>
              <input value={newRoom} onChange={e => setNewRoom(e.target.value)} placeholder="e.g. LT 3"
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid #e0e4ea", borderRadius: 8, fontSize: 14 }} required />
            </div>
            <button className={styles.btnPrimary} type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create Session"}
            </button>
          </form>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            No sessions yet today. Click "New Session" to start one.
          </div>
        </div>
      ) : (
        <div className={styles.grid2}>
          {/* Session list */}
          <div className={styles.card} style={{ margin: 0 }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>📋 Today's Sessions</div>
            </div>
            {sessions.map(s => (
              <div key={s.id}
                className={`${styles.sessionItem} ${selected?.id === s.id ? styles.sessionItemActive : ""}`}
                onClick={() => setSelected(s)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{s.course_name}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{s.course_code} · {s.room}</div>
                  </div>
                  <span className={`${styles.badge} ${s.status === "active" ? styles.badgeActive : styles.badgeEnded}`}>
                    {s.status === "active" ? "Active" : "Ended"}
                  </span>
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <div className={styles.progressTrack} style={{ flex: 1 }}>
                    <div className={styles.progressFill} style={{ width: `${s.enrolled ? Math.round(s.present / s.enrolled * 100) : 0}%` }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{s.present}/{s.enrolled}</span>
                </div>
              </div>
            ))}
          </div>

          {/* QR Panel */}
          {selected && (
            <div className={styles.card} style={{ margin: 0 }}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>📱 QR Code — {selected.course_code}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#003366" }}>{selected.course_name}</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{selected.room}</div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Present", val: selected.present,                     color: "#1a7a4a" },
                  { label: "Absent",  val: selected.enrolled - selected.present, color: "#8B0000" },
                  { label: "Rate",    val: `${pct}%`,                            color: "#003366" },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: "#f8f9fb", border: "1px solid #e0e4ea", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {selected.status === "active" ? (
                <div className={styles.qrWrapper}>
                  {qrData ? (
                    <>
                      <div className={styles.qrBox}>
                        <QRCodeSVG value={qrData.qrValue} size={200} bgColor="#ffffff" fgColor="#003366" level="H" />
                      </div>
                      <div className={styles.qrCode}>{selected.course_code.replace(" ", "")}</div>
                      <div className={styles.qrLabel}>Students scan this with their phone camera</div>
                      <div className={styles.qrTimer}>⏱ Expires {new Date(qrData.expiry).toLocaleTimeString()}</div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button className={styles.btnSecondary} onClick={() => setQrData(null)}>Hide QR</button>
                        <button className={styles.btnSecondary} onClick={handleEndSession}>End Session</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.scannerIcon}>📲</div>
                      <div className={styles.scannerText}>Generate a QR code for students to scan and mark attendance</div>
                      <button className={styles.btnPrimary} onClick={handleGenerateQR}>Generate QR Code</button>
                      <button className={styles.btnSecondary} onClick={handleEndSession}>End Session</button>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.qrWrapper}>
                  <div className={styles.scannerIcon}>🔒</div>
                  <div className={styles.scannerText}>Session ended. QR codes can only be generated for active sessions.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Student list */}
      {selected && (
        <div className={styles.card} style={{ marginTop: 20 }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>👥 Student Attendance — {selected.course_name}</div>
            <button className={styles.btnPrimary} style={{ fontSize: 12, padding: "7px 14px" }}>⬇ Export</button>
          </div>
          {students.length === 0 ? (
            <div className={styles.emptyState}>No attendance records yet for this session.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr><th>Index Number</th><th>Student Name</th><th>Time Scanned</th><th>Status</th></tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td><code style={{ fontSize: 12, background: "#f0f2f5", padding: "2px 7px", borderRadius: 4 }}>{s.index_number}</code></td>
                    <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                    <td style={{ color: "#888" }}>{s.scanned_at ? new Date(s.scanned_at).toLocaleTimeString() : "—"}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        s.status === "present" ? styles.badgePresent :
                        s.status === "late"    ? styles.badgeLate    : styles.badgeAbsent
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: ATTENDANCE RECORDS (per course)
══════════════════════════════════════ */
function RecordsPage() {
  const [courses, setCourses]                 = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [report, setReport]                   = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");

  useEffect(() => {
    getCourses()
      .then(list => {
        setCourses(list);
        if (list.length > 0) setSelectedCourseId(String(list[0].id));
      })
      .catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    getCourseReport(selectedCourseId)
      .then(setReport)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedCourseId]);

  return (
    <div className={styles.content}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>📋 Attendance Records</div>
          {courses.length > 0 && (
            <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #e0e4ea", borderRadius: 8, fontSize: 13 }}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          )}
        </div>

        {loading && <div className={styles.emptyState}>Loading…</div>}
        {error && <div style={{ color: "#8B0000", padding: "12px 0" }}>{error}</div>}

        {report && !loading && (
          <>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#003366", margin: "8px 0 4px" }}>
              Sessions
            </div>
            {report.sessions.length === 0 ? (
              <div className={styles.emptyState}>No sessions held yet for this course.</div>
            ) : (
              <table className={styles.table} style={{ marginBottom: 24 }}>
                <thead>
                  <tr><th>Date</th><th>Room</th><th>Present</th><th>Absent</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {report.sessions.map(s => (
                    <tr key={s.id}>
                      <td style={{ color: "#888" }}>{s.date}</td>
                      <td>{s.room}</td>
                      <td style={{ color: "#1a7a4a", fontWeight: 600 }}>{s.present}</td>
                      <td style={{ color: "#8B0000", fontWeight: 600 }}>{s.absent}</td>
                      <td>
                        <span className={`${styles.badge} ${s.status === "active" ? styles.badgeActive : styles.badgeEnded}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#003366", margin: "8px 0 4px" }}>
              Students
            </div>
            {report.students.length === 0 ? (
              <div className={styles.emptyState}>No students enrolled in this course.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr><th>Name</th><th>Index Number</th><th>Attended</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {report.students.map((s, i) => {
                    const pct = s.total > 0 ? Math.round(s.attended / s.total * 100) : 0;
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ color: "#888" }}>{s.index_number}</td>
                        <td>{s.attended}/{s.total}</td>
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
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: PROFILE
══════════════════════════════════════ */
function ProfilePage({ user }) {
  const fields = [
    { label: "Staff ID",   value: user.staffId || user.id },
    { label: "Department", value: user.dept || "Computer Science & IT" },
    { label: "Email",      value: user.email },
    { label: "Role",       value: "Lecturer" },
  ];
  return (
    <div className={styles.content}>
      <div className={styles.profileBanner}>
        <div className={styles.profileAvatar}>{initials(user.name)}</div>
        <div>
          <div className={styles.profileName}>{user.name}</div>
          <div className={styles.profileRole}>Lecturer</div>
          <div className={styles.profileDept}>{user.dept || "Computer Science & IT"}</div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle} style={{ marginBottom: 16 }}>Account Details</div>
        <div className={styles.profileGrid}>
          {fields.map(f => (
            <div key={f.label} className={styles.profileField}>
              <div className={styles.profileFieldLabel}>{f.label}</div>
              <div className={styles.profileFieldValue}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   ROOT
══════════════════════════════════════ */
export default function LecturerDashboard() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("Dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const titles = {
    Dashboard: `Good morning, ${user.name.split(" ")[0]} 👋`,
    Sessions:  "Sessions & QR Code",
    Records:   "Attendance Records",
    Reports:   "Reports & Analytics",
    Profile:   "My Profile",
  };

  return (
    <div className={styles.shell}>
      <GlobalTopBar title={titles[page]} onMenuClick={() => setDrawerOpen(true)} />
      <div className={styles.body}>
        <Sidebar active={page} setActive={setPage} logout={logout}
          drawerOpen={drawerOpen} closeDrawer={() => setDrawerOpen(false)} />
        <main className={styles.main}>
          {page === "Dashboard" && <DashboardPage />}
          {page === "Sessions"  && <SessionsPage />}
          {page === "Records"   && <RecordsPage />}
          {page === "Reports"   && (
            <div className={styles.content}><ReportsTab /></div>
          )}
          {page === "Profile"   && <ProfilePage user={user} />}
          <div className={styles.footer}>
            © {new Date().getFullYear()} University of Cape Coast · AttendUCC Smart Attendance System
          </div>
        </main>
      </div>
    </div>
  );
}
