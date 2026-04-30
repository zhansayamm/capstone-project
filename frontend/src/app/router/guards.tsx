import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { UserRole } from "../../shared/types/auth";
import { useAuthStore } from "../../features/auth/store/useAuthStore";

export function RequireAuth() {
  const location = useLocation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  if (!hydrated) return null;
  if (!isAuthed) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

export function RequireRole(props: { roles: UserRole[] }) {
  const { roles } = props;
  const hydrated = useAuthStore((s) => s.hydrated);
  const userRole = useAuthStore((s) => s.user?.role ?? null);

  if (!hydrated) return null;
  if (!userRole) return <Navigate to="/login" replace />;
  if (!roles.includes(userRole)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

