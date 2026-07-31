import { useState, useEffect, useRef } from "react";
import { Bell, Info, CheckCircle2, AlertTriangle, AlertOctagon, Inbox, RefreshCw } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("attenducc_token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// Type colours
const TYPE_STYLES = {
  info:    { bg: "#e6f0ff", border: "#003366", icon: Info,          color: "#003366" },
  success: { bg: "#e6f9f0", border: "#1a7a4a", icon: CheckCircle2,  color: "#1a7a4a" },
  warning: { bg: "#fff8e6", border: "#C9A84C", icon: AlertTriangle, color: "#b07800" },
  danger:  { bg: "#fdecea", border: "#8B0000", icon: AlertOctagon,  color: "#8B0000" },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen]                   = useState(false);
  const [loading, setLoading]             = useState(false);
  const dropdownRef                       = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Mark single as read
  const markRead = async (id) => {
    try {
      await fetch(`${BASE_URL}/notifications/${id}/read`, { method: "POST", headers: authHeaders() });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) { console.error(err); }
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await fetch(`${BASE_URL}/notifications/read-all`, { method: "POST", headers: authHeaders() });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) { console.error(err); }
  };

  // Load on mount and every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>

      {/* Bell button */}
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        style={{
          width: 38, height: 38, borderRadius: "50%",
          background: open ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 17, position: "relative",
          transition: "background 0.2s",
        }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            width: 16, height: 16, borderRadius: "50%",
            background: "#8B0000", color: "#fff",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #003366",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: 46, right: 0,
          width: 340, maxHeight: 480,
          background: "#fff", borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,51,102,0.18)",
          border: "1px solid #e0e4ea",
          zIndex: 9999, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderBottom: "1px solid #f0f2f5",
            background: "#003366",
          }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14, color: "#fff", display: "flex", alignItems: "center", gap: 7 }}>
              <Bell size={15} />Notifications {unreadCount > 0 && (
                <span style={{ background: "#8B0000", color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 11, marginLeft: 6 }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                fontSize: 11, cursor: "pointer", padding: "4px 10px", borderRadius: 6, fontWeight: 600,
              }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && (
              <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>Loading…</div>
            )}

            {!loading && notifications.length === 0 && (
              <div style={{ padding: 32, textAlign: "center" }}>
                <div style={{ marginBottom: 10, display: "flex", justifyContent: "center", color: "#ccc" }}><Inbox size={32} /></div>
                <div style={{ color: "#aaa", fontSize: 13 }}>No notifications yet</div>
              </div>
            )}

            {!loading && notifications.map(n => {
              const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
              const TypeIcon = style.icon;
              return (
                <div key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid #f0f2f5",
                    background: n.is_read ? "#fff" : style.bg,
                    borderLeft: n.is_read ? "3px solid transparent" : `3px solid ${style.border}`,
                    cursor: n.is_read ? "default" : "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, marginTop: 1, color: style.color }}><TypeIcon size={18} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: n.is_read ? "#555" : style.color, marginBottom: 3 }}>
                        {n.title}
                        {!n.is_read && (
                          <span style={{ width: 7, height: 7, background: style.border, borderRadius: "50%", display: "inline-block", marginLeft: 6, verticalAlign: "middle" }} />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 5 }}>{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 18px", borderTop: "1px solid #f0f2f5", textAlign: "center" }}>
            <button onClick={fetchNotifications} style={{
              background: "transparent", border: "none", color: "#003366",
              fontSize: 12, cursor: "pointer", fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <RefreshCw size={12} />Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
