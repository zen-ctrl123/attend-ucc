import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, getSavedUser } from "../api";

const AuthContext = createContext(null);

const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef            = useRef(null);

  // ── Reset the inactivity timer on any user activity ──
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Auto logout after 30 mins of inactivity
      apiLogout();
      setUser(null);
      alert("You have been logged out due to 30 minutes of inactivity.");
    }, INACTIVITY_LIMIT);
  }, []);

  // ── Attach activity listeners ──
  useEffect(() => {
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  // ── Check if user is already logged in when app loads ──
  useEffect(() => {
    const saved = getSavedUser();
    if (saved) {
      setUser(saved);
      resetTimer();
    }
    setLoading(false);
  }, [resetTimer]);

  const login = async (identifier, password, role) => {
    const user = await apiLogin(identifier, password, role);
    setUser(user);
    resetTimer();
    return user;
  };

  const logout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    apiLogout();
    setUser(null);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}