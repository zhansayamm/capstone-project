import { Spin } from "antd";
import { Navigate, Outlet, useLocation, type Location } from "react-router-dom";

import { useAuthStore } from "../../features/auth/store/useAuthStore";

function loginPathSafely(location: Pick<Location, "pathname" | "search" | "hash">) {
  const { pathname } = location;
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/login")
  ) {
    return "/login";
  }
  const full = location.pathname + location.search + location.hash;
  if (!full.startsWith("/") || full.startsWith("//")) {
    return "/login";
  }
  return `/login?next=${encodeURIComponent(full)}`;
}

export function ProtectedRoute() {
  const location = useLocation();
  const hydrated = useAuthStore((s) => s.hydrated);
  const authReady = useAuthStore((s) => s.authReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = !hydrated || !authReady;

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to={loginPathSafely(location)} replace />;
  }
  return <Outlet />;
}

