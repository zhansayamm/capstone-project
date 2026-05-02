import { Avatar, Button, Layout, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { API_URL } from "../config/api";
import { useAuthStore } from "../features/auth/store/useAuthStore";
import { NotificationsDropdown } from "./notifications/NotificationsDropdown";

export function AppTopbar() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const user = useAuthStore((s) => s.user);
  const label = useMemo(() => {
    if (role === "admin") return "Admin";
    if (role === "professor") return "Professor";
    if (role === "student") return "Student";
    return "User";
  }, [role]);

  const displayName = useMemo(() => {
    const fn = user?.first_name?.trim();
    const ln = user?.last_name?.trim();
    const full = [fn, ln].filter(Boolean).join(" ");
    return full || user?.email || "User";
  }, [user?.email, user?.first_name, user?.last_name]);

  const avatarSrc = user?.avatar_image_id ? `${String(API_URL || "http://localhost:8000")}/images/${user.avatar_image_id}` : undefined;
  const initials = useMemo(() => {
    const fn = user?.first_name?.trim()?.[0] ?? "";
    const ln = user?.last_name?.trim()?.[0] ?? "";
    const s = (fn + ln).toUpperCase();
    if (s) return s;
    return (user?.email?.[0] ?? "U").toUpperCase();
  }, [user?.email, user?.first_name, user?.last_name]);

  return (
    <Layout.Header
      style={{
        background: "#fff",
        padding: "0 18px",
        borderBottom: "1px solid rgba(5,5,5,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Typography.Text strong>Booking Time</Typography.Text>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button
          type="text"
          onClick={() => navigate("/profile")}
          aria-label="Open profile"
          style={{ padding: 0, display: "flex", alignItems: "center" }}
        >
          <Avatar
            size={36}
            src={avatarSrc}
            style={{
              backgroundColor: "#3b82f6",
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1 }}>
              {initials}
            </span>
          </Avatar>
        </Button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Typography.Text type="secondary">{displayName}</Typography.Text>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {label}
          </Tag>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <NotificationsDropdown />
        </div>
      </div>
    </Layout.Header>
  );
}

