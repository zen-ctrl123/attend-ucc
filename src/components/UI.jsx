import styles from "./UI.module.css";

export function Badge({ color = "blue", children }) {
  return <span className={`${styles.badge} ${styles[color]}`}>{children}</span>;
}

export function StatCard({ label, value, sub, color = "var(--accent)" }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue} style={{ color }}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36, color = "var(--accent)" }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.33, color, borderColor: color + "55", background: color + "22" }}>
      {initials}
    </div>
  );
}

export function ProgressBar({ value, color = "var(--accent)" }) {
  return (
    <div className={styles.progressTrack}>
      <div className={styles.progressFill} style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function Spinner() {
  return <div className={styles.spinner} />;
}