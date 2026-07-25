import { createContext, useContext, useState, useEffect } from "react";
import { login as apiLogin, logout as apiLogout, getSavedUser } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const saved = getSavedUser();
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  const login = async (identifier, password, role) => {
    const user = await apiLogin(identifier, password, role);
    setUser(user);
    return user;
  };

  const logout = () => {
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