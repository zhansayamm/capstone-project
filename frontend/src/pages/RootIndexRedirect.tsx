import { Spin } from "antd";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/useAuthStore";

export function RootIndexRedirect() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const authReady = useAuthStore((s) => s.authReady);
  const role = useAuthStore((s) => s.user?.role);

  if (!hydrated || !authReady) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!role) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role === "professor") return <Navigate to="/professor/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
}

