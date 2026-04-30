import { Navigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/useAuthStore";

export function RootIndexRedirect() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role === "professor") return <Navigate to="/professor/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
}

