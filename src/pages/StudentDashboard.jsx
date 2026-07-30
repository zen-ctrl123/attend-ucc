import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import { validateAttendance } from "../utils/locationValidator";
import { scanAttendance, getCourses, getStudentAttendance } from "../api";
import styles from "./Dashboard.module.css";

function initials(name) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("");
}

/* ── GLOBAL TOP BAR ── */
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
          <div className={styles.topBarBrandSub}>Student Portal</div>
        </div>
      </div>
      <div className={styles.topBarTitle}>{title}</div>
      <div className={styles.topBarRight}>
        <span className={styles.topBarDate}>📅 {today}</span>
        <button className={styles.notifBtn}>🔔<span className={styles.notifDot} /></button>
      </div>
    </div>
  );
}

/* ── SIDEBAR ── */
function Sidebar({ active, setActive, user, logout, drawerOpen, closeDrawer }) {
  const navItems = [
    { key: "Dashboard",  icon: "🏠", label: "Dashboard"         },
    { key: "Scan",       icon: "📸", label: "Scan QR Code"      },
    { key: "Attendance", icon: "📊", label: "My Attendance"     },
    { key: "Records",    icon: "📋", label: "My Records"        },
    { key: "Profile",    icon: "👤", label: "Profile"           },
  ];

  const handleNavClick = (key) => {
    setActive(key);
    closeDrawer();
  };

  return (
    <>
      {drawerOpen && <div className={styles.drawerOverlay} onClick={closeDrawer} />}
      <aside className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar}>{initials(user.name)}</div>
          <div>
            <div className={styles.sidebarUserName}>{user.name}</div>
          </div>
        </div>

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
   PAGE: DASHBOARD
══════════════════════════════════════ */
function DashboardPage({ user }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.content}><div className={styles.emptyState}>Loading your courses…</div></div>;
  if (error)   return <div className={styles.content}><div className={`${styles.alertBanner} ${styles.danger}`}>⚠️ {error}</div></div>;

  const withPct = courses.map(c => {
    const pct  = c.total_sessions > 0 ? Math.round((c.attended / c.total_sessions) * 100) : 100;
    const risk = c.total_sessions > 0 && (c.attended / c.total_sessions) < 0.75;
    return { ...c, pct, risk };
  });

  const totalSessions = courses.reduce((a, c) => a + c.total_sessions, 0);
  const totalAttended = courses.reduce((a, c) => a + c.attended, 0);
  const overall = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 100;
  const atRisk  = withPct.filter(c => c.risk).length;

  return (
    <div className={styles.content}>

      <div style={{ marginBottom: 4 }}>
        <p style={{ fontSize: 13, color: "#888" }}>{user.indexNumber} · Level {user.level} · {user.programme}</p>
      </div>

      {atRisk > 0 && (
        <div className={`${styles.alertBanner} ${styles.danger}`} style={{ marginTop: 16 }}>
          ⚠️ <strong>{atRisk} course{atRisk > 1 ? "s" : ""} at risk</strong> — attendance below the 75% threshold
        </div>
      )}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statVal}>{overall}%</div>
          <div className={styles.statLabel}>Overall Attendance</div>
          <div className={styles.statSub}>Across {courses.length} courses</div>
        </div>
        <div className={`${styles.statCard} ${styles.green}`}>
          <div className={styles.statVal}>{totalAttended}</div>
          <div className={styles.statLabel}>Classes Attended</div>
        </div>
        <div className={`${styles.statCard} ${styles.red}`}>
          <div className={styles.statVal}>{totalSessions - totalAttended}</div>
          <div className={styles.statLabel}>Classes Missed</div>
        </div>
        <div className={`${styles.statCard} ${styles.gold}`}>
          <div className={styles.statVal}>{atRisk}</div>
          <div className={styles.statLabel}>Courses At Risk</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>📚 Course Breakdown</div>
        </div>
        {withPct.length === 0 ? (
          <div className={styles.emptyState}>You're not enrolled in any courses yet.</div>
        ) : withPct.map(c => (
          <div key={c.id} className={styles.courseRow}>
            <div style={{ flex: 1 }}>
              <div className={styles.courseName}>{c.name}</div>
              <div className={styles.courseCode}>{c.code}</div>
            </div>
            <div className={styles.courseRight}>
              <div style={{ flex: 1 }}>
                <div className={styles.progressTrack}>
                  <div className={`${styles.progressFill} ${c.pct < 70 ? styles.red : c.pct < 85 ? styles.gold : styles.green}`}
                    style={{ width: `${c.pct}%` }} />
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{c.attended}/{c.total_sessions} classes</div>
              </div>
              <span className={styles.coursePct} style={{ color: c.pct < 75 ? "#8B0000" : "#003366" }}>{c.pct}%</span>
              {c.risk && <span className={`${styles.badge} ${styles.badgeAbsent}`}>At Risk</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: SCAN QR CODE
══════════════════════════════════════ */
function ScanPage() {
  const [state, setState]             = useState("idle");
  const [scannedText, setScannedText] = useState("");
  const [validation, setValidation]   = useState(null);
  const [resultStatus, setResultStatus] = useState("");
  const [scanError, setScanError]     = useState("");
  const scannerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
      }
    };
  }, []);

  const startValidation = async () => {
    setState("validating");
    const result = await validateAttendance();
    setValidation(result);
    setState(result.overall ? "ready" : "validation_failed");
  };

  const openCamera = () => {
    setState("scanning");
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decodedText) => {
            html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
            const token = decodedText.split("/").pop();
            setScannedText(decodedText);
            scanAttendance(token, validation?.gps?.lat || null, validation?.gps?.lng || null, validation?.ip?.ip || null)
              .then(res => { setResultStatus(res.status); setState("success"); })
              .catch(err => { setScanError(err.message); setState("scan_failed"); });
          },
          () => {}
        );
      } catch (err) {
        setScanError(err.message?.includes("NotAllowedError") || err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access and try again."
          : "Could not start the camera: " + (err.message || err));
        setState("scan_failed");
      }
    }, 100);
  };

  const reset = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
      scannerRef.current = null;
    }
    setState("idle"); setScannedText(""); setValidation(null); setScanError("");
  };

  const CheckRow = ({ label, checked, allowed, detail, error }) => {
    const icon  = !checked ? "⏳" : allowed ? "✅" : "❌";
    const color = !checked ? "#888" : allowed ? "#1a7a4a" : "#8B0000";
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #f0f2f5" }}>
        <span style={{ fontSize: 18, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color }}>{label}</div>
          {detail && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{detail}</div>}
          {error  && <div style={{ fontSize: 12, color: "#8B0000", marginTop: 2 }}>{error}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.content}>
      <div className={styles.alertBanner} style={{ marginBottom: 20 }}>
        📚 Scan the QR code your lecturer displays in class to mark your attendance
      </div>

      <div className={styles.card} style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className={styles.cardTitle} style={{ marginBottom: 20 }}>📸 Attendance Scanner</div>

        {state === "idle" && (
          <div className={styles.scannerBox}>
            <div className={styles.scannerIcon}>🔐</div>
            <div className={styles.scannerText}>
              AttendUCC will verify you are physically inside the classroom and on the campus network before allowing you to scan.
            </div>
            <button className={styles.btnPrimary} onClick={startValidation}>Verify My Location</button>
          </div>
        )}

        {state === "validating" && (
          <div className={styles.scannerBox}>
            <div className={styles.scannerIcon}>📡</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#003366" }}>
              Checking your location and network…
            </div>
            <div className={styles.scannerText}>Please wait a few seconds.</div>
          </div>
        )}

        {(state === "validation_failed" || state === "ready") && validation && (
          <div style={{ background: "#f8f9fb", border: "1px solid #e0e4ea", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#003366", marginBottom: 4 }}>
              🔐 Attendance Verification
            </div>
            <CheckRow label="GPS Location" checked={validation.gps.checked} allowed={validation.gps.allowed}
              detail={validation.gps.checked && validation.gps.allowed ? validation.gps.detail : null}
              error={validation.gps.error} />
            <CheckRow label="Campus Network" checked={validation.ip.checked} allowed={validation.ip.allowed}
              detail={validation.ip.checked && validation.ip.allowed ? validation.ip.reason : null}
              error={validation.ip.error} />
          </div>
        )}

        {state === "validation_failed" && (
          <div className={`${styles.scannerBox} ${styles.scannerError}`}>
            <div className={styles.scannerIcon}>🚫</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "#8B0000" }}>Attendance Blocked</div>
            <div className={styles.scannerText} style={{ color: "#8B0000" }}>
              You must be inside the classroom and on the UCC campus network or mobile data to mark attendance.
            </div>
            <button className={styles.btnPrimary} style={{ background: "#8B0000" }} onClick={startValidation}>Try Again</button>
            <button className={styles.btnSecondary} onClick={reset} style={{ marginTop: 8 }}>Cancel</button>
          </div>
        )}

        {state === "ready" && (
          <div className={`${styles.scannerBox} ${styles.scannerSuccess}`}>
            <div className={styles.scannerIcon}>✅</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "#1a7a4a" }}>Verification Passed!</div>
            <div className={styles.scannerText} style={{ color: "#1a7a4a" }}>
              You're inside the classroom and on the network. Now scan the QR code.
            </div>
            <button className={styles.btnPrimary} style={{ background: "#1a7a4a" }} onClick={openCamera}>Open Camera & Scan</button>
          </div>
        )}

        {state === "scanning" && (
          <div>
            <div id="qr-reader" style={{ width: "100%", borderRadius: 10, overflow: "hidden" }} />
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button className={styles.btnSecondary} onClick={reset}>Cancel</button>
            </div>
          </div>
        )}

        {state === "scan_failed" && (
          <div className={`${styles.scannerBox} ${styles.scannerError}`}>
            <div className={styles.scannerIcon}>⚠️</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "#8B0000" }}>Couldn't Mark Attendance</div>
            <div className={styles.scannerText} style={{ color: "#8B0000" }}>{scanError}</div>
            <button className={styles.btnPrimary} style={{ background: "#8B0000" }} onClick={reset}>Try Again</button>
          </div>
        )}

        {state === "success" && (
          <div className={`${styles.scannerBox} ${styles.scannerSuccess}`}>
            <div className={styles.scannerIcon}>🎉</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: "#1a7a4a" }}>Attendance Marked!</div>
            <div className={styles.scannerText} style={{ color: "#1a7a4a" }}>
             You've been recorded as present for <strong>{ACTIVE_SESSION.course}</strong>.
            </div>
            <div style={{ fontSize: 11, color: "#aaa", wordBreak: "break-all" }}>{scannedText}</div>
            <button className={styles.btnPrimary} style={{ background: "#1a7a4a" }}
              onClick={() => { reset(); setPage("Dashboard"); }}>
              Done — Go to Dashboard
            </button>
          </div>
        )}
      </div>

      <div className={styles.card} style={{ maxWidth: 520, margin: "20px auto 0" }}>
        <div className={styles.cardTitle} style={{ marginBottom: 16 }}>ℹ️ How Verification Works</div>
        {[
          ["📍", "GPS check",     "Confirms you're within metres of the lecture room"],
          ["📶", "Network check", "Confirms you're on UCC Wi-Fi or Ghanaian mobile data"],
          ["📱", "QR scan",       "Scans the unique code your lecturer displays"],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid #f0f2f5" }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#003366" }}>{title}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: MY ATTENDANCE
══════════════════════════════════════ */
function AttendancePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.content}><div className={styles.emptyState}>Loading…</div></div>;
  if (error)   return <div className={styles.content}><div className={`${styles.alertBanner} ${styles.danger}`}>⚠️ {error}</div></div>;

  return (
    <div className={styles.content}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>📊 Attendance by Course</div>
        </div>
        {courses.length === 0 ? (
          <div className={styles.emptyState}>You're not enrolled in any courses yet.</div>
        ) : courses.map(c => {
          const pct  = c.total_sessions > 0 ? Math.round((c.attended / c.total_sessions) * 100) : 100;
          const risk = c.total_sessions > 0 && (c.attended / c.total_sessions) < 0.75;
          return (
            <div key={c.id} className={styles.courseRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.courseName}>{c.name}</div>
                <div className={styles.courseCode}>{c.code}</div>
              </div>
              <div className={styles.courseRight}>
                <div style={{ flex: 1 }}>
                  <div className={styles.progressTrack}>
                    <div className={`${styles.progressFill} ${pct < 70 ? styles.red : pct < 85 ? styles.gold : styles.green}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{c.attended}/{c.total_sessions} classes</div>
                </div>
                <span className={styles.coursePct} style={{ color: pct < 75 ? "#8B0000" : "#003366" }}>{pct}%</span>
                {risk
                  ? <span className={`${styles.badge} ${styles.badgeAbsent}`}>At Risk</span>
                  : <span className={`${styles.badge} ${styles.badgePresent}`}>On Track</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE: MY RECORDS
══════════════════════════════════════ */
function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    getStudentAttendance()
      .then(setRecords)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.content}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>📋 Attendance History</div>
          <button className={styles.btnPrimary}>⬇ Export</button>
        </div>
        {loading ? (
          <div className={styles.emptyState}>Loading…</div>
        ) : error ? (
          <div style={{ color: "#8B0000", padding: "12px 0" }}>{error}</div>
        ) : records.length === 0 ? (
          <div className={styles.emptyState}>No attendance records yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Date</th><th>Course</th><th>Time Scanned</th><th>Status</th></tr>
            </thead>
            <tbody>
              {records.map((h, i) => (
                <tr key={i}>
                  <td style={{ color: "#888" }}>{h.date}</td>
                  <td style={{ fontWeight: 600 }}>{h.course_name} <span style={{ color: "#aaa", fontWeight: 400 }}>({h.course_code})</span></td>
                  <td style={{ color: "#888" }}>{h.scanned_at ? new Date(h.scanned_at).toLocaleTimeString() : "—"}</td>
                  <td>
                    <span className={`${styles.badge} ${
                      h.status === "present" ? styles.badgePresent :
                      h.status === "late"    ? styles.badgeLate    : styles.badgeAbsent
                    }`}>{h.status}</span>
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
   PAGE: PROFILE
══════════════════════════════════════ */
function ProfilePage({ user }) {
  const fields = [
    { label: "Index Number", value: user.indexNumber },
    { label: "Level",        value: `${user.level} Level` },
    { label: "Email",        value: user.email },
    { label: "Programme",    value: user.programme },
  ];
  return (
    <div className={styles.content}>
      <div className={styles.profileBanner}>
        <div className={styles.profileAvatar}
          style={{ borderColor: "#1a7a4a", color: "#1a7a4a", background: "rgba(26,122,74,0.2)" }}>
          {initials(user.name)}
        </div>
        <div>
          <div className={styles.profileName}>{user.name}</div>
          <div className={styles.profileRole} style={{ color: "#4ade80" }}>Student</div>
          <div className={styles.profileDept}>{user.programme} · Level {user.level}</div>
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
export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("Dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const titles = {
    Dashboard:  `Welcome, ${user.name.split(" ")[0]} 🎓`,
    Scan:       "Scan QR Code",
    Attendance: "My Attendance",
    Records:    "My Records",
    Profile:    "My Profile",
  };

  return (
    <div className={styles.shell}>
      <GlobalTopBar title={titles[page]} onMenuClick={() => setDrawerOpen(true)} />
      <div className={styles.body}>
        <Sidebar active={page} setActive={setPage} user={user} logout={logout}
          drawerOpen={drawerOpen} closeDrawer={() => setDrawerOpen(false)} />
        <main className={styles.main}>
          {page === "Dashboard"  && <DashboardPage  user={user} />}
          {page === "Scan"       && <ScanPage />}
          {page === "Attendance" && <AttendancePage />}
          {page === "Records"    && <RecordsPage />}
          {page === "Profile"    && <ProfilePage user={user} />}
          <div className={styles.footer}>
            © {new Date().getFullYear()} University of Cape Coast · AttendUCC Smart Attendance System
          </div>
        </main>
      </div>
    </div>
  );
}
