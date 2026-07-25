import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import ReportsTab from "./ReportsTab";
import styles from "./Dashboard.module.css";

/* ── Mock data ── */
const SESSIONS = [
  { id: 1, course: "Introduction to Programming", code: "ITC 101", time: "08:00 – 10:00", room: "LT 3",      status: "active", enrolled: 42, present: 38 },
  { id: 2, course: "Data Structures & Algorithms", code: "ITC 203", time: "10:00 – 12:00", room: "LT 1",      status: "active", enrolled: 36, present: 30 },
  { id: 3, course: "Web Technologies",             code: "ITC 305", time: "12:00 – 14:00", room: "ICT Lab 2", status: "ended",  enrolled: 29, present: 27 },
  { id: 4, course: "Database Management Systems",  code: "ITC 207", time: "14:00 – 16:00", room: "LT 2",      status: "ended",  enrolled: 40, present: 35 },
];

const STUDENTS = [
  { id: "PS/ITC/22/0001", name: "Ama Asante",     status: "present", time: "08:03" },
  { id: "PS/ITC/22/0008", name: "Kwame Boateng",  status: "present", time: "08:07" },
  { id: "PS/ITC/22/0014", name: "Efua Mensah",    status: "late",    time: "08:22" },
  { id: "PS/ITC/22/0019", name: "Kofi Darkwa",    status: "absent",  time: "—"    },
  { id: "PS/ITC/22/0027", name: "Abena Owusu",    status: "present", time: "07:59" },
  { id: "PS/ITC/22/0033", name: "Yaw Frimpong",   status: "present", time: "08:01" },
  { id: "PS/ITC/22/0041", name: "Akosua Sarpong", status: "absent",  time: "—"    },
];

function initials(name) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("");
}

/* ── GLOBAL TOP BAR (logo + brand + page title + date/notif) ── */
function GlobalTopBar({ title }) {
  const today = new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarBrand}>
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
        <button className={styles.notifBtn}>
          🔔
          <span className={styles.notifDot} />
        </button>
      </div>
    </div>
  );
}

/* ── SIDEBAR (now sits under the top bar, no logo) ── */
function Sidebar({ active, setActive, logout }) {
  const navItems = [
    { key: "Dashboard",  icon: "🏠", label: "Dashboard"          },
    { key: "Sessions",   icon: "📱", label: "Sessions & QR Code"  },
    { key: "Records",    icon: "📋", label: "Attendance Records"  },
    { key: "Reports",    icon: "📊", label: "Reports"             },
    { key: "Profile",    icon: "👤", label: "Profile"             },
  ];

  return (
    <aside className={styles.sidebar}>
      {/* Nav */}
      <nav className={styles.sidebarNav}>
        <div className={styles.navSection}>Main Menu</div>
        {navItems.map(item => (
          <button key={item.key}
            className={`${styles.navItem} ${active === item.key ? styles.navItemActive : ""}`}
            onClick={() => setActive(item.key)}>
            <span className={styles.navIcon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className={styles.sidebarBottom}>
        <button className={styles.logoutBtn} onClick={logout}>
          <span className={styles.navIcon}>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════
   PAGE: DASHBOARD (HOME)
══════════════════════════════════════ */
function DashboardPage() {
  const active = SESSIONS.filter(s => s.status === "active");

  return (
    <div className={styles.content}>

      {active.length > 0 && (
        <div className={styles.alertBanner}>
          🟢 <strong>{active.length} session{active.length !== 1 ? "s" : ""} in progress</strong> — students can currently scan attendance
        </div>
      )}

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statVal}>{SESSIONS.length}</div>
          <div className={styles.statLabel}>Today's Sessions</div>
        </div>
        <div className={`${styles.statCard} ${styles.gold}`}>
          <div className={styles.statVal}>{SESSIONS.reduce((a, s) => a + s.enrolled, 0)}</div>
          <div className={styles.statLabel}>Total Enrolled</div>
        </div>
        <div className={`${styles.statCard} ${styles.green}`}>
          <div className={styles.statVal}>{SESSIONS.reduce((a, s) => a + s.present, 0)}</div>
          <div className={styles.statLabel}>Present Today</div>
        </div>
        <div className={`${styles.statCard} ${styles.red}`}>
          <div className={styles.statVal}>{SESSIONS.reduce((a, s) => a + (s.enrolled - s.present), 0)}</div>
          <div className={styles.statLabel}>Absent Today</div>
        </div>
      </div>

      {/* Today's schedule */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>📅 Today's Schedule</div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Course</th><th>Code</th><th>Time</th><th>Room</th><th>Attendance</th><th>Status</th></tr>
          </thead>
          <tbody>
            {SESSIONS.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.course}</td>
                <td><code style={{ background: "#f0f2f5", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{s.code}</code></td>
                <td>{s.time}</td>
                <td>{s.room}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 140 }}>
                    <div className={styles.progressTrack} style={{ flex: 1 }}>
                      <div className={`${styles.progressFill} ${s.present / s.enrolled < 0.7 ? styles.red : ""}`}
                        style={{ width: `${Math.round(s.present / s.enrolled * 100)}%` }} />
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
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: SESSIONS & QR
══════════════════════════════════════ */
function SessionsPage() {
  const [selected, setSelected] = useState(SESSIONS[0]);
  const [qrVisible, setQrVisible] = useState(false);
  const qrValue = `https://attend-ucc.app/scan/${selected.code.replace(" ", "")}-${Date.now()}`;
  const pct = Math.round(selected.present / selected.enrolled * 100);

  return (
    <div className={styles.content}>
      <div className={styles.grid2}>

        {/* Session list */}
        <div className={styles.card} style={{ margin: 0 }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>📋 Today's Sessions</div>
          </div>
          {SESSIONS.map(s => (
            <div key={s.id}
              className={`${styles.sessionItem} ${selected.id === s.id ? styles.sessionItemActive : ""}`}
              onClick={() => { setSelected(s); setQrVisible(false); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>{s.course}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{s.code} · {s.time} · {s.room}</div>
                </div>
                <span className={`${styles.badge} ${s.status === "active" ? styles.badgeActive : styles.badgeEnded}`}>
                  {s.status === "active" ? "Active" : "Ended"}
                </span>
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <div className={styles.progressTrack} style={{ flex: 1 }}>
                  <div className={styles.progressFill} style={{ width: `${Math.round(s.present / s.enrolled * 100)}%` }} />
                </div>
                <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{s.present}/{s.enrolled}</span>
              </div>
            </div>
          ))}
        </div>

        {/* QR Panel */}
        <div className={styles.card} style={{ margin: 0 }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>📱 QR Code — {selected.code}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#003366" }}>{selected.course}</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{selected.time} · {selected.room}</div>
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
              {qrVisible ? (
                <>
                  <div className={styles.qrBox}>
                    <QRCodeSVG value={qrValue} size={200} bgColor="#ffffff" fgColor="#003366" level="H" />
                  </div>
                  <div className={styles.qrCode}>{selected.code.replace(" ", "")}</div>
                  <div className={styles.qrLabel}>Students scan this with their phone camera</div>
                  <div className={styles.qrTimer}>⏱ Expires in 10 minutes</div>
                  <button className={styles.btnSecondary} onClick={() => setQrVisible(false)}>Hide QR</button>
                </>
              ) : (
                <>
                  <div className={styles.scannerIcon}>📲</div>
                  <div className={styles.scannerText}>Generate a QR code for students to scan and mark attendance</div>
                  <button className={styles.btnPrimary} onClick={() => setQrVisible(true)}>Generate QR Code</button>
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
      </div>

      {/* Student list */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>👥 Student Attendance — {selected.course}</div>
          <button className={styles.btnPrimary} style={{ fontSize: 12, padding: "7px 14px" }}>⬇ Export</button>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Index Number</th><th>Student Name</th><th>Time Scanned</th><th>Status</th></tr>
          </thead>
          <tbody>
            {STUDENTS.map(s => (
              <tr key={s.id}>
                <td><code style={{ fontSize: 12, background: "#f0f2f5", padding: "2px 7px", borderRadius: 4 }}>{s.id}</code></td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td style={{ color: "#888" }}>{s.time}</td>
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
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: ATTENDANCE RECORDS
══════════════════════════════════════ */
function RecordsPage() {
  return (
    <div className={styles.content}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>📋 All Sessions</div>
          <button className={styles.btnPrimary}>⬇ Export CSV</button>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Course</th><th>Code</th><th>Date</th><th>Room</th><th>Present</th><th>Absent</th><th>Rate</th><th>Status</th></tr>
          </thead>
          <tbody>
            {SESSIONS.map(s => {
              const pct = Math.round(s.present / s.enrolled * 100);
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.course}</td>
                  <td><code style={{ background: "#f0f2f5", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{s.code}</code></td>
                  <td style={{ color: "#888" }}>Today</td>
                  <td>{s.room}</td>
                  <td style={{ color: "#1a7a4a", fontWeight: 600 }}>{s.present}</td>
                  <td style={{ color: "#8B0000", fontWeight: 600 }}>{s.enrolled - s.present}</td>
                  <td>
                    <span className={`${styles.badge} ${pct >= 85 ? styles.badgePresent : pct >= 75 ? styles.badgeLate : styles.badgeAbsent}`}>
                      {pct}%
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${s.status === "active" ? styles.badgeActive : styles.badgeEnded}`}>
                      {s.status}
                    </span>
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

  const titles = {
    Dashboard: `Good morning, ${user.name.split(" ")[0]} 👋`,
    Sessions:  "Sessions & QR Code",
    Records:   "Attendance Records",
    Reports:   "Reports & Analytics",
    Profile:   "My Profile",
  };

  return (
    <div className={styles.shell}>
      <GlobalTopBar title={titles[page]} />
      <div className={styles.body}>
        <Sidebar active={page} setActive={setPage} logout={logout} />
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
