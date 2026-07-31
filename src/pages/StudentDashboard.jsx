import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Html5Qrcode } from "html5-qrcode";
import { getCurrentPosition, getPublicIP } from "../utils/locationValidator";
import { scanAttendance, getCourses, getStudentAttendance } from "../api";
import NotificationBell from "../components/NotificationBell";
import {
  Menu, Calendar, Home, Camera, BarChart3, ClipboardList, User, LogOut,
  AlertTriangle, BookOpen, Satellite, CheckCircle2, MapPin, QrCode, Info, Download,
} from "lucide-react";
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
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Open menu"><Menu size={22} /></button>
        <img src="/ucc-logo.png" alt="UCC" className={styles.topBarLogo}
          onError={e => e.target.style.display = "none"} />
        <div>
          <div className={styles.topBarBrandTitle}>AttendUCC</div>
          <div className={styles.topBarBrandSub}>Student Portal</div>
        </div>
      </div>
      <div className={styles.topBarTitle}>{title}</div>
      <div className={styles.topBarRight}>
        <span className={styles.topBarDate} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Calendar size={14} />{today}
        </span>
        <NotificationBell />
      </div>
    </div>
  );
}

/* ── SIDEBAR ── */
function Sidebar({ active, setActive, user, logout, drawerOpen, closeDrawer }) {
  const navItems = [
    { key: "Dashboard",  icon: Home,          label: "Dashboard"         },
    { key: "Scan",       icon: Camera,        label: "Scan QR Code"      },
    { key: "Attendance", icon: BarChart3,     label: "My Attendance"     },
    { key: "Records",    icon: ClipboardList, label: "My Records"        },
    { key: "Profile",    icon: User,          label: "Profile"           },
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
              <span className={styles.navIcon}><item.icon size={18} /></span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <button className={styles.logoutBtn} onClick={logout}>
            <span className={styles.navIcon}><LogOut size={18} /></span>
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
  if (error)   return <div className={styles.content}><div className={`${styles.alertBanner} ${styles.danger}`}><AlertTriangle size={18} />{error}</div></div>;

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
          <AlertTriangle size={18} />
          <span><strong>{atRisk} course{atRisk > 1 ? "s" : ""} at risk</strong> — attendance below the 75% threshold</span>
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
          <div className={styles.cardTitle}><BookOpen size={16} />Course Breakdown</div>
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
function ScanPage({ setPage }) {
  // scanning -> verifying -> success | scan_failed
  const [state, setState]             = useState("scanning");
  const [scannedText, setScannedText] = useState("");
  const [resultStatus, setResultStatus] = useState("");
  const [scanError, setScanError]     = useState("");
  const scannerRef = useRef(null);
  const gpsRef      = useRef(null);
  const ipRef       = useRef(null);
  const genRef      = useRef(0); // bumped on every (re)start; invalidates stale in-flight starts

  // Camera opens immediately, and GPS/IP capture start in parallel in the
  // background — neither blocks the other, and neither needs a click.
  const startCapture = () => {
    gpsRef.current = getCurrentPosition();
    ipRef.current  = getPublicIP();
  };

  // html5-qrcode's .stop() throws SYNCHRONOUSLY (not just a rejected promise)
  // if called before .start() has fully resolved — which happens whenever a
  // cleanup fires while the camera is still mid-startup (e.g. React
  // StrictMode's dev-only double-invoke). A plain .catch() doesn't catch that.
  const safeStop = (instance) => {
    try {
      instance.stop().then(() => instance.clear()).catch(() => {});
    } catch { /* wasn't running yet */ }
  };

  // html5-qrcode's .start() is async, and .stop() is only valid once it has
  // actually resolved — calling .stop() any earlier is a no-op (swallowed by
  // safeStop above), not a real cancellation. So a stop requested WHILE
  // .start() is still in flight (React StrictMode's dev-only double-invoke
  // cleanup, or a fast "Try Again" click) can't rely on stopping the camera
  // directly; instead this generation counter is checked once .start()
  // finally resolves, and tears the stream down then if it's since been
  // superseded — otherwise the old stream would keep running live, unowned.
  const openCamera = async () => {
    const myGen = ++genRef.current;
    setState("scanning");
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          if (genRef.current !== myGen) return; // stale scanner instance, ignore
          safeStop(html5QrCode);
          scannerRef.current = null;
          setScannedText(decodedText);
          setState("verifying");

          (async () => {
            let pos;
            try {
              pos = await gpsRef.current;
            } catch (err) {
              setScanError(err.message);
              setState("scan_failed");
              return;
            }
            const ip = await ipRef.current.catch(() => null);
            scanAttendance(decodedText, pos.lat, pos.lng, ip)
              .then(res => { setResultStatus(res.status); setState("success"); })
              .catch(err => { setScanError(err.message); setState("scan_failed"); });
          })();
        },
        () => {}
      );
      if (genRef.current !== myGen) { safeStop(html5QrCode); return; }
      scannerRef.current = html5QrCode;
    } catch (err) {
      if (genRef.current !== myGen) return;
      setScanError(err.message?.includes("NotAllowedError") || err.name === "NotAllowedError"
        ? "Camera permission was denied. Please allow camera access and try again."
        : "Could not start the camera: " + (err.message || err));
      setState("scan_failed");
    }
  };

  useEffect(() => {
    startCapture();
    openCamera();
    return () => {
      genRef.current++; // invalidate this mount's in-flight/active scanner
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) safeStop(instance);
    };
  }, []);

  const retry = () => {
    genRef.current++; // invalidate the previous attempt's in-flight/active scanner
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (instance) safeStop(instance);
    setScannedText(""); setScanError("");
    startCapture();
    openCamera();
  };

  return (
    <div className={styles.content}>
      <div className={styles.alertBanner} style={{ marginBottom: 20 }}>
        <BookOpen size={18} />
        <span>Scan the QR code your lecturer displays in class to mark your attendance</span>
      </div>

      <div className={styles.card} style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className={styles.cardTitle} style={{ marginBottom: 20 }}><Camera size={16} />Attendance Scanner</div>

        {state === "scanning" && (
          <div>
            <div id="qr-reader" style={{ width: "100%", borderRadius: 10, overflow: "hidden" }} />
          </div>
        )}

        {state === "verifying" && (
          <div className={styles.scannerBox}>
            <div className={styles.scannerIcon}><Satellite size={48} /></div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#003366" }}>
              Verifying your location…
            </div>
            <div className={styles.scannerText}>Please wait a moment.</div>
          </div>
        )}

        {state === "scan_failed" && (
          <div className={`${styles.scannerBox} ${styles.scannerError}`}>
            <div className={styles.scannerIcon}><AlertTriangle size={48} /></div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "#8B0000" }}>Couldn't Mark Attendance</div>
            <div className={styles.scannerText} style={{ color: "#8B0000" }}>{scanError}</div>
            <button className={styles.btnPrimary} style={{ background: "#8B0000" }} onClick={retry}>Try Again</button>
          </div>
        )}

        {state === "success" && (
          <div className={`${styles.scannerBox} ${styles.scannerSuccess}`}>
            <div className={styles.scannerIcon}><CheckCircle2 size={48} color="#1a7a4a" /></div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: "#1a7a4a" }}>Attendance Marked!</div>
            <div className={styles.scannerText} style={{ color: "#1a7a4a" }}>
             You've been recorded as {resultStatus === "late" ? "late" : "present"} for this session.
            </div>
            <div style={{ fontSize: 11, color: "#aaa", wordBreak: "break-all" }}>{scannedText}</div>
            <button className={styles.btnPrimary} style={{ background: "#1a7a4a" }}
              onClick={() => setPage("Dashboard")}>
              Done — Go to Dashboard
            </button>
          </div>
        )}
      </div>

      <div className={styles.card} style={{ maxWidth: 520, margin: "20px auto 0" }}>
        <div className={styles.cardTitle} style={{ marginBottom: 16 }}><Info size={16} />How Verification Works</div>
        {[
          { icon: MapPin, title: "GPS check", desc: "Automatically confirms you're within metres of the lecture room" },
          { icon: QrCode, title: "QR scan",   desc: "Scans the unique code your lecturer displays" },
        ].map((item) => (
          <div key={item.title} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid #f0f2f5" }}>
            <span style={{ color: "#003366", flexShrink: 0 }}><item.icon size={20} /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#003366" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{item.desc}</div>
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
  if (error)   return <div className={styles.content}><div className={`${styles.alertBanner} ${styles.danger}`}><AlertTriangle size={18} />{error}</div></div>;

  return (
    <div className={styles.content}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}><BarChart3 size={16} />Attendance by Course</div>
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
          <div className={styles.cardTitle}><ClipboardList size={16} />Attendance History</div>
          <button className={styles.btnPrimary}><Download size={13} />Export</button>
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
    Dashboard:  `Welcome, ${user.name.split(" ")[0]}`,
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
          {page === "Scan"       && <ScanPage setPage={setPage} />}
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
