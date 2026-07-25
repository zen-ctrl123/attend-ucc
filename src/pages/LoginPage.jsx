import { useState } from "react";
import { register } from "../api";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/UI";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { login } = useAuth();
  const [role, setRole]             = useState("student");
  const [id, setId]                 = useState("");
  const [password, setPassword]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [signupRole, setSignupRole] = useState("student");
  const [signupName, setSignupName] = useState("");
  const [signupIdNumber, setSignupIdNumber] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  async function handleSubmit() {
    if (!id || !password) { setError("Please fill in all fields."); return; }
    setError("");
    setLoading(true);
    try {
      await login(id, password, role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Left — UCC Branding */}
        <div className={styles.leftPanel}>
          <img src="/ucc-logo.png" alt="UCC Logo" className={styles.logo}
            onError={(e) => { e.target.style.display = "none"; }} />
          <div className={styles.dividerLine} />
          <h1 className={styles.systemName}>AttendUCC</h1>
          <p className={styles.systemDesc}>Smart Attendance Management System</p>
        </div>

        {/* Right — Login Form */}
        <div className={styles.rightPanel}>
          <h3 className={styles.formTitle}>Sign In</h3>
          <p className={styles.formSub}>Access your attendance portal</p>

          <div className={styles.toggle}>
            {["student", "lecturer"].map((r) => (
              <button key={r} onClick={() => { setRole(r); setError(""); }}
                className={styles.toggleBtn}
                style={{ background: role === r ? "#003366" : "transparent", color: role === r ? "#fff" : "#003366" }}>
                {r === "student" ? "🎓 Student" : "👨‍🏫 Lecturer"}
              </button>
            ))}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              {role === "student" ? "Student Index Number" : "Staff ID"}
            </label>
            <input className={styles.input}
              placeholder={role === "student" ? "e.g. PS/ITC/22/0074" : "e.g. L001"}
              value={id} onChange={(e) => setId(e.target.value)} />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          </div>

          <div className={styles.forgotRow}>
            <button className={styles.forgotBtn}>Forgot Password?</button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? <><Spinner /> Signing in…</> : "Get Me In"}
          </button>

          <div className={styles.signupRow}>
            <span>Don't have an account?</span>
            <button className={styles.signupLink} onClick={() => setShowSignup(true)}>
              Create Account
            </button>
          </div>
        </div>
      </div>

      <p className={styles.footer}>
        © {new Date().getFullYear()} University of Cape Coast · Computer Science & IT
      </p>

      {/* Signup Modal */}
      {showSignup && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>Create Account</h2>
            <p className={styles.modalSub}>Register for AttendUCC</p>

            <div className={styles.toggle} style={{ marginBottom: 20 }}>
              {["student", "lecturer"].map((r) => (
                <button key={r} onClick={() => setSignupRole(r)}
                  className={styles.toggleBtn}
                  style={{ background: signupRole === r ? "#003366" : "transparent", color: signupRole === r ? "#fff" : "#003366" }}>
                  {r === "student" ? "🎓 Student" : "👨‍🏫 Lecturer"}
                </button>
              ))}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Full Name</label>
              <input className={styles.input} placeholder="e.g. Bart Addison Stanley"
                value={signupName} onChange={(e) => setSignupName(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{signupRole === "student" ? "Index Number" : "Staff ID"}</label>
              <input className={styles.input} placeholder={signupRole === "student" ? "e.g. PS/ITC/22/0074" : "e.g. L001"}
                value={signupIdNumber} onChange={(e) => setSignupIdNumber(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>UCC Email</label>
              <input className={styles.input} placeholder="e.g. name@ucc.edu.gh"
                value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Password</label>
              <input className={styles.input} type="password" placeholder="••••••••"
                value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Confirm Password</label>
              <input className={styles.input} type="password" placeholder="••••••••"
                value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)} />
            </div>

            {signupError && <div className={styles.error}>{signupError}</div>}

            <button className={styles.submitBtn} disabled={signupLoading}
            onClick={async () => {
              setSignupError("");
              if (!signupName || !signupIdNumber || !signupEmail || !signupPassword || !signupConfirm) {
               setSignupError("Please fill in all fields.");
               return;
              }
              if (signupPassword !== signupConfirm) {
                setSignupError("Passwords do not match.");
                return;
              }
             setSignupLoading(true);
              try {
                const payload = {
                 name: signupName,
                 email: signupEmail,
                 password: signupPassword,
                 role: signupRole,
                 ...(signupRole === "student"
                 ? { index_number: signupIdNumber }
                 : { staff_id: signupIdNumber }),
              };
              await register(payload);
              setShowSignup(false);
              alert("Account created successfully! You can now log in.");
              // Clear the form
              setSignupName(""); setSignupIdNumber(""); setSignupEmail("");
              setSignupPassword(""); setSignupConfirm("");
              } catch (err) {
                setSignupError(err.message);
              } finally {
                setSignupLoading(false);
              }
            }}>
             {signupLoading ? "Creating Account..." : "Create Account"}
            </button>
            <button className={styles.cancelBtn} onClick={() => setShowSignup(false)}>
              ← Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}