import {
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  DashboardOutlined,
  LogoutOutlined,
  NotificationOutlined,
  ScheduleOutlined,
  TableOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Divider, Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../features/auth/store/useAuthStore";

type Item = Required<MenuProps>["items"][number];

function roleMenu(role: "student" | "professor" | "admin"): Item[] {
  if (role === "student") {
    return [
      { key: "/student", icon: <DashboardOutlined />, label: "Dashboard" },
      { key: "/student/slots", icon: <ScheduleOutlined />, label: "Available slots" },
      { key: "/student/bookings", icon: <BookOutlined />, label: "My bookings" },
      { key: "/student/reservations", icon: <TableOutlined />, label: "My reservations" },
      { key: "/notifications", icon: <NotificationOutlined />, label: "Notifications" },
      { key: "/student/calendar", icon: <CalendarOutlined />, label: "Calendar" },
      { key: "/profile", icon: <UserOutlined />, label: "Profile" },
    ];
  }
  if (role === "professor") {
    return [
      { key: "/professor", icon: <DashboardOutlined />, label: "Dashboard" },
      { key: "/professor/slots", icon: <ScheduleOutlined />, label: "My slots" },
      { key: "/professor/bookings", icon: <BookOutlined />, label: "Bookings" },
      { key: "/notifications", icon: <NotificationOutlined />, label: "Notifications" },
      { key: "/professor/calendar", icon: <CalendarOutlined />, label: "Calendar" },
      { key: "/profile", icon: <UserOutlined />, label: "Profile" },
    ];
  }
  return [
    { key: "/admin", icon: <DashboardOutlined />, label: "Dashboard" },
    { key: "/admin/bookings", icon: <BookOutlined />, label: "Bookings" },
    { key: "/admin/calendar", icon: <CalendarOutlined />, label: "Calendar" },
    { key: "/admin/reservations", icon: <TableOutlined />, label: "Reservations" },
    { key: "/admin/classrooms", icon: <ScheduleOutlined />, label: "Classrooms" },
    { key: "/admin/analytics", icon: <BarChartOutlined />, label: "Analytics" },
    { key: "/notifications", icon: <NotificationOutlined />, label: "Notifications" },
    { key: "/profile", icon: <UserOutlined />, label: "Profile" },
  ];
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const items = useMemo(() => roleMenu(user?.role ?? "student"), [user?.role]);
  const selected = [location.pathname];

  return (
    <Layout.Sider
      width={260}
      breakpoint="lg"
      collapsedWidth={0}
      style={{
        background: "#fff",
        borderRight: "1px solid rgba(5,5,5,0.06)",
      }}
    >
      <div style={{ padding: 18 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Booking Time
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          University booking system
        </Typography.Text>
      </div>
      <Menu
        mode="inline"
        items={items}
        selectedKeys={selected}
        onClick={(e) => navigate(e.key)}
        style={{ borderInlineEnd: 0 }}
      />
      <Divider style={{ margin: "12px 0" }} />
      <div style={{ padding: 12 }}>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          Signed in as {user?.email ?? "—"}
        </Typography.Text>
        <Button
          icon={<LogoutOutlined />}
          onClick={() => {
            logout();
            navigate("/login");
          }}
          block
        >
          Log out
        </Button>
      </div>
    </Layout.Sider>
  );
}

