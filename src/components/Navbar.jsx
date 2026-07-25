import { useAuth } from "../context/AuthContext";
import { Avatar } from "./UI";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const isLecturer = user?.role === "lecturer";
  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <span className={styles.logo}>AttendUCC</span>
        <span className={styles.roleBadge} style={{
          background: isLecturer ? "rgba(0,194,255,0.1)" : "rgba(0,229,160,0.1)",
          color: isLecturer ? "var(--accent)" : "var(--green)",
          borderColor: isLecturer ? "rgba(0,194,255,0.3)" : "rgba(0,229,160,0.3)",
        }}>
          {user?.role?.toUpperCase()}
        </span>
      </div>
      <div className={styles.right}>
        <Avatar name={user?.name || "User"} size={34} color={isLecturer ? "var(--accent)" : "var(--green)"} />
        <button className={styles.logoutBtn} onClick={logout}>Logout</button>
      </div>
    </header>
  );
}