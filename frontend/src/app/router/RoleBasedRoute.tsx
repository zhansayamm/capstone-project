import { Spin } from "antd";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { UserRole } from "../../shared/types/auth";
import { useAuthStore } from "../../features/auth/store/useAuthStore";

export function RoleBasedRoute(props: { roles: UserRole[] }) {
  const { roles } = props;
  const location = useLocation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const authReady = useAuthStore((s) => s.authReady);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const user = useAuthStore((s) => s.user);

  const loading = !hydrated || !authReady;

  useEffect(() => {
    console.log("USER:", user, "LOADING:", loading, "PATH:", location.pathname);
  }, [user, loading, location.pathname]);

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

