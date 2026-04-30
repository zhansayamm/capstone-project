import { Navigate, Outlet } from "react-router-dom";

import type { UserRole } from "../../shared/types/auth";
import { useAuthStore } from "../../features/auth/store/useAuthStore";

export function RoleBasedRoute(props: { roles: UserRole[] }) {
  const { roles } = props;
  const hydrated = useAuthStore((s) => s.hydrated);
  const role = useAuthStore((s) => s.user?.role ?? null);

  if (!hydrated) return null;
  if (!role) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

