import { Layout } from "antd";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { AppSidebar } from "../../widgets/AppSidebar";
import { AppTopbar } from "../../widgets/AppTopbar";
import { useAuthActions } from "../../features/auth/hooks/useAuthActions";
import { useAuthStore } from "../../features/auth/store/useAuthStore";
import { usePolling } from "../../shared/hooks/usePolling";
import { useNotificationsStore } from "../../features/notifications/store/useNotificationsStore";

export function RoleShellLayout() {
  const { hydrateMe } = useAuthActions();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchNotifications = useNotificationsStore((s) => s.fetch);

  useEffect(() => {
    if (token && !user) hydrateMe();
  }, [hydrateMe, token, user]);

  usePolling(fetchNotifications, 30_000, isAuthenticated);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <AppSidebar />
      <Layout>
        <AppTopbar />
        <Outlet />
      </Layout>
    </Layout>
  );
}

