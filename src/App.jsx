import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import LecturerDashboard from "./pages/LecturerDashboard";
import StudentDashboard from "./pages/StudentDashboard";

function AppRouter() {
  const { user } = useAuth();

  if (!user) return <LoginPage />;
  if (user.role === "lecturer") return <LecturerDashboard />;
  if (user.role === "student") return <StudentDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}