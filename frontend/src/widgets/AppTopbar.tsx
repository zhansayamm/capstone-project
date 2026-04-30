import { Avatar, Button, Layout, Modal, Space, Tag, Typography, Upload, message } from "antd";
import { useMemo, useState } from "react";

import { useAuthStore } from "../features/auth/store/useAuthStore";
import { NotificationsDropdown } from "./notifications/NotificationsDropdown";
import { getImageTask, uploadImage } from "../shared/api/modules/imageApi";
import { setMyAvatar } from "../shared/api/modules/userApi";
import { useAuthActions } from "../features/auth/hooks/useAuthActions";

export function AppTopbar() {
  const { hydrateMe } = useAuthActions();
  const role = useAuthStore((s) => s.user?.role);
  const user = useAuthStore((s) => s.user);
  const label = useMemo(() => {
    if (role === "admin") return "Admin";
    if (role === "professor") return "Professor";
    if (role === "student") return "Student";
    return "User";
  }, [role]);

  const [open, setOpen] = useState(false);
  const displayName = useMemo(() => {
    const fn = user?.first_name?.trim();
    const ln = user?.last_name?.trim();
    const full = [fn, ln].filter(Boolean).join(" ");
    return full || user?.email || "User";
  }, [user?.email, user?.first_name, user?.last_name]);

  const avatarSrc = user?.avatar_image_id ? `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/images/${user.avatar_image_id}` : undefined;
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
      <Space>
        <Button type="text" onClick={() => setOpen(true)} style={{ padding: 0 }}>
          {/* <Avatar src={avatarSrc} style={{ backgroundColor: "#1677ff" }}>
            {initials}
          </Avatar> */}
          <div onClick={() => setOpen(true)} style={{ cursor: "pointer" }}>
  <Avatar src={avatarSrc} style={{ backgroundColor: "#1677ff" }}>
    {initials}
  </Avatar>
</div>
        </Button>
        <Typography.Text type="secondary">{displayName}</Typography.Text>
        <Tag color="blue">{label}</Tag>
        <NotificationsDropdown />
      </Space>

      <Modal title="Update avatar" open={open} onCancel={() => setOpen(false)} footer={null}>
        <Typography.Paragraph type="secondary">
          Upload a JPG/PNG (max 5MB). It will be compressed in the background.
        </Typography.Paragraph>
        <Upload
          accept="image/png,image/jpeg"
          maxCount={1}
          beforeUpload={async (file) => {
            try {
              const res = await uploadImage(file as unknown as File);
              message.info("Uploading… processing in background");

              // Poll task until SUCCESS/FAILURE (max ~20s)
              for (let i = 0; i < 20; i++) {
                const status = await getImageTask(res.task_id);
                if (status.status === "SUCCESS") {
                  if (typeof status.image_id === "number" && Number.isFinite(status.image_id)) {
                    await setMyAvatar(status.image_id);
                    await hydrateMe();
                    message.success("Avatar updated");
                    setOpen(false);
                    return false;
                  }
                  // Task finished but no image_id available (e.g. result backend not storing return value yet).
                  message.info("Still finalizing image…");
                }
                if (status.status === "FAILURE") {
                  message.error("Image processing failed");
                  return false;
                }
                await new Promise((r) => setTimeout(r, 1000));
              }

              message.warning("Still processing. Please try again in a moment.");
              return false;
            } catch (e) {
              message.error("Upload failed");
              return false;
            }
          }}
        >
          <Button type="primary">Select image</Button>
        </Upload>
      </Modal>
    </Layout.Header>
  );
}

