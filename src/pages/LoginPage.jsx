import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { register, resendOtp } from "../api";
import { GraduationCap, Briefcase, Eye, EyeOff, X, ArrowLeft, MailCheck } from "lucide-react";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { login, completeLogin } = useAuth();
  const [role, setRole]         = useState("student");
  const [id, setId]             = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // OTP step — shown after a correct password (login) or a successful
  // signup, since both now stop short of a session until this is entered.
  const [otpEmail, setOtpEmail]     = useState(null);
  const [otpCode, setOtpCode]       = useState("");
  const [otpError, setOtpError]     = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Signup state
  const [showSignup, setShowSignup]   = useState(false);
  const [signupRole, setSignupRole]   = useState("student");
  const [signupName, setSignupName]   = useState("");
  const [signupId, setSignupId]       = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPw, setSignupPw]       = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupPw, setShowSignupPw]   = useState(false);
  const [signupDept, setSignupDept]   = useState("");
  const [signupLevel, setSignupLevel] = useState("100");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  // Lecturer course rows during signup
  const [courses, setCourses] = useState([{ name: "", code: "" }]);

  const addCourseRow    = () => setCourses([...courses, { name: "", code: "" }]);
  const removeCourseRow = (i) => setCourses(courses.filter((_, idx) => idx !== i));
  const updateCourse    = (i, field, val) => {
    const updated = [...courses];
    updated[i][field] = val;
    setCourses(updated);
  };

  // ── Login ──
  const handleLogin = async () => {
    if (!id || !password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      const result = await login(id, password, role);
      if (result?.requiresOtp) { setOtpEmail(result.email); setResendCooldown(30); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP (shared by login and signup) ──
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { setOtpError("Enter the 6-digit code."); return; }
    setOtpError(""); setOtpLoading(true);
    try {
      await completeLogin(otpEmail, otpCode);
      // success flips AuthContext's user state, which unmounts this page.
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError("");
    try {
      await resendOtp(otpEmail);
      setResendCooldown(30);
    } catch (err) {
      setOtpError(err.message);
    }
  };

  const cancelOtp = () => {
    setOtpEmail(null); setOtpCode(""); setOtpError(""); setResendCooldown(0);
  };

  // ── Register ──
  const handleRegister = async () => {
    setSignupError("");
    if (!signupName || !signupId || !signupEmail || !signupPw || !signupConfirm) {
      setSignupError("Please fill in all fields."); return;
    }
    if (signupPw !== signupConfirm) { setSignupError("Passwords do not match."); return; }
    if (signupPw.length < 6) { setSignupError("Password must be at least 6 characters."); return; }

    setSignupLoading(true);
    try {
      const payload = {
        name:     signupName,
        email:    signupEmail,
        password: signupPw,
        role:     signupRole,
        ...(signupRole === "student"
          ? { index_number: signupId, level: signupLevel }
          : { staff_id: signupId, dept: signupDept || "Computer Science & IT",
              courses: courses.filter(c => c.name && c.code) }),
      };
      const result = await register(payload);
      setShowSignup(false);
      setSignupName(""); setSignupId(""); setSignupEmail("");
      setSignupPw(""); setSignupConfirm(""); setCourses([{ name: "", code: "" }]);
      if (result?.requiresOtp) { setOtpEmail(result.email); setResendCooldown(30); }
    } catch (err) {
      setSignupError(err.message);
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Left Panel ── */}
        <div className={styles.leftPanel}>
          <img src="/ucc-logo.png" alt="UCC" className={styles.logo}
            onError={e => e.target.style.display = "none"} />
          <h1 className={styles.uniName}>University of Cape Coast</h1>
          <p className={styles.uniMotto}>Veritas · Nobis · Lumen</p>
          <div className={styles.dividerLine} />
          <h2 className={styles.systemName}>AttendUCC</h2>
          <p className={styles.systemDesc}>Smart Attendance Management System</p>
        </div>

        {/* ── Right Panel ── */}
        <div className={styles.rightPanel}>
          <h3 className={styles.formTitle}>Sign In</h3>
          <p className={styles.formSub}>Access your attendance portal</p>

          {/* Role toggle */}
          <div className={styles.toggle}>
            {["student", "lecturer"].map(r => (
              <button key={r} onClick={() => { setRole(r); setError(""); }}
                className={styles.toggleBtn}
                style={{ background: role === r ? "#003366" : "transparent", color: role === r ? "#fff" : "#003366" }}>
                {r === "student"
                  ? <><GraduationCap size={15} style={{ marginRight: 6, verticalAlign: -3 }} />Student</>
                  : <><Briefcase size={15} style={{ marginRight: 6, verticalAlign: -3 }} />Lecturer</>}
              </button>
            ))}
          </div>

          {/* ID field */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{role === "student" ? "Student Index Number" : "Staff ID"}</label>
            <input className={styles.input}
              placeholder={role === "student" ? "e.g. PS/ITC/22/0074" : "e.g. L001"}
              value={id} onChange={e => setId(e.target.value)} />
          </div>

          {/* Password with show/hide */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Password</label>
            <div className={styles.passwordWrapper}>
              <input className={styles.input} type={showPw ? "text" : "password"}
                placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className={styles.forgotRow}>
            <button className={styles.forgotBtn}
              onClick={() => alert("Please contact your department administrator to reset your password.")}>
              Forgot Password?
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Get Me In"}
          </button>

          <div className={styles.signupRow}>
            <span>Don't have an account?</span>
            <button className={styles.signupLink} onClick={() => setShowSignup(true)}>Create Account</button>
          </div>
        </div>
      </div>

      <p className={styles.footer}>© {new Date().getFullYear()} University of Cape Coast · Computer Science & IT</p>

      {/* ── Signup Modal ── */}
      {showSignup && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>Create Account</h2>
            <p className={styles.modalSub}>Register for AttendUCC</p>

            {/* Role toggle */}
            <div className={styles.toggle} style={{ marginBottom: 20 }}>
              {["student", "lecturer"].map(r => (
                <button key={r} onClick={() => setSignupRole(r)}
                  className={styles.toggleBtn}
                  style={{ background: signupRole === r ? "#003366" : "transparent", color: signupRole === r ? "#fff" : "#003366" }}>
                  {r === "student"
                  ? <><GraduationCap size={15} style={{ marginRight: 6, verticalAlign: -3 }} />Student</>
                  : <><Briefcase size={15} style={{ marginRight: 6, verticalAlign: -3 }} />Lecturer</>}
                </button>
              ))}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Full Name</label>
              <input className={styles.input} placeholder="e.g. Bart Addison Stanley"
                value={signupName} onChange={e => setSignupName(e.target.value)} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>{signupRole === "student" ? "Index Number" : "Staff ID"}</label>
              <input className={styles.input}
                placeholder={signupRole === "student" ? "e.g. PS/ITC/22/0074" : "e.g. L002"}
                value={signupId} onChange={e => setSignupId(e.target.value)} />
            </div>

            {signupRole === "student" && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Level</label>
                <select className={styles.input} value={signupLevel} onChange={e => setSignupLevel(e.target.value)}>
                  <option value="100">Level 100</option>
                  <option value="200">Level 200</option>
                  <option value="300">Level 300</option>
                  <option value="400">Level 400</option>
                </select>
              </div>
            )}

            {signupRole === "lecturer" && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Department</label>
                <input className={styles.input} placeholder="e.g. Computer Science & IT"
                  value={signupDept} onChange={e => setSignupDept(e.target.value)} />
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.label}>UCC Email</label>
              <input className={styles.input} placeholder="e.g. name@ucc.edu.gh"
                value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
            </div>

            {/* Password with show/hide */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Password</label>
              <div className={styles.passwordWrapper}>
                <input className={styles.input} type={showSignupPw ? "text" : "password"}
                  placeholder="Min. 6 characters" value={signupPw}
                  onChange={e => setSignupPw(e.target.value)} />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowSignupPw(!showSignupPw)}>
                  {showSignupPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Confirm Password</label>
              <input className={styles.input} type="password" placeholder="••••••••"
                value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} />
            </div>

            {/* Lecturer course creation */}
            {signupRole === "lecturer" && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Your Courses</label>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                  Add the courses you teach. You can add more later from your dashboard.
                </p>
                {courses.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input className={styles.input} placeholder="Course Name (e.g. Data Structures)"
                      style={{ flex: 2 }} value={c.name} onChange={e => updateCourse(i, "name", e.target.value)} />
                    <input className={styles.input} placeholder="Code (e.g. INF 107)"
                      style={{ flex: 1 }} value={c.code} onChange={e => updateCourse(i, "code", e.target.value)} />
                    {courses.length > 1 && (
                      <button onClick={() => removeCourseRow(i)}
                        style={{ background: "#fdecea", border: "none", borderRadius: 6, padding: "8px 10px", cursor: "pointer", color: "#8B0000", display: "flex", alignItems: "center" }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addCourseRow}
                  style={{ background: "transparent", border: "1.5px dashed #003366", borderRadius: 8, padding: "8px 14px", color: "#003366", cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%", marginTop: 4 }}>
                  + Add Another Course
                </button>
              </div>
            )}

            {signupError && <div className={styles.error}>{signupError}</div>}

            <button className={styles.submitBtn} disabled={signupLoading} onClick={handleRegister}>
              {signupLoading ? "Creating Account…" : "Create Account"}
            </button>
            <button className={styles.cancelBtn} onClick={() => setShowSignup(false)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <ArrowLeft size={14} />Back to Login
            </button>
          </div>
        </div>
      )}

      {/* ── OTP Modal — shared by login and signup, both end here ── */}
      {otpEmail && (
        <div className={styles.modal}>
          <div className={styles.modalCard} style={{ maxWidth: 400, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <MailCheck size={40} color="#003366" />
            </div>
            <h2 className={styles.modalTitle}>Enter Verification Code</h2>
            <p className={styles.modalSub}>We sent a 6-digit code to <strong>{otpEmail}</strong></p>

            <div className={styles.fieldGroup} style={{ textAlign: "left" }}>
              <label className={styles.label}>Verification Code</label>
              <input className={styles.input}
                style={{ textAlign: "center", fontSize: 22, letterSpacing: "0.5em", fontWeight: 700 }}
                inputMode="numeric" maxLength={6} placeholder="------"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                autoFocus />
            </div>

            {otpError && <div className={styles.error}>{otpError}</div>}

            <button className={styles.submitBtn} disabled={otpLoading} onClick={handleVerifyOtp}>
              {otpLoading ? "Verifying…" : "Verify & Continue"}
            </button>

            <button className={styles.forgotBtn} style={{ display: "block", margin: "10px auto 0" }}
              disabled={resendCooldown > 0} onClick={handleResendOtp}>
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>

            <button className={styles.cancelBtn} onClick={cancelOtp}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <ArrowLeft size={14} />Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}