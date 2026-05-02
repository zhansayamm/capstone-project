import { Spin } from "antd";
import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "../../features/auth/store/useAuthStore";

import type { UserRole } from "../../shared/types/auth";

export function RoleBasedRoute(props: { roles: UserRole[] }) {
  const { roles } = props;
  const hydrated = useAuthStore((s) => s.hydrated);
  const authReady = useAuthStore((s) => s.authReady);
  const role = useAuthStore((s) => s.user?.role ?? null);

  const loading = !hydrated || !authReady;

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!role) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

