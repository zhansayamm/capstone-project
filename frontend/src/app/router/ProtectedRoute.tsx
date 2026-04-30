import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../../features/auth/store/useAuthStore";

export function ProtectedRoute() {
  const location = useLocation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!hydrated) return null;
  if (!isAuthenticated) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

