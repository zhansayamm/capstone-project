import { BankOutlined, CameraOutlined, MailOutlined, SafetyOutlined } from "@ant-design/icons";
import { Avatar, Button, Card, Descriptions, Divider, Flex, Skeleton, Space, Tag, Typography, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useMemo, useState } from "react";

import { useAuthActions } from "../../features/auth/hooks/useAuthActions";
import { useAuthStore } from "../../features/auth/store/useAuthStore";
import { listUniversities, requestPasswordReset } from "../../shared/api/modules/authApi";
import { getImageTask, uploadImage } from "../../shared/api/modules/imageApi";
import { setMyAvatar } from "../../shared/api/modules/userApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { Page } from "../../shared/ui/Page";

function roleLabel(role: string | undefined) {
  if (role === "admin") return "Admin";
  if (role === "professor") return "Professor";
  if (role === "student") return "Student";
  return "User";
}

export function ProfilePage() {
  const { hydrateMe } = useAuthActions();
  const user = useAuthStore((s) => s.user);
  const me = useAsync(hydrateMe);
  const universities = useAsync(listUniversities);
  const resetPassword = useAsync(requestPasswordReset);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    me.run();
    universities.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = useMemo(() => {
    const fn = user?.first_name?.trim();
    const ln = user?.last_name?.trim();
    const full = [fn, ln].filter(Boolean).join(" ");
    return full || user?.email || "User";
  }, [user?.email, user?.first_name, user?.last_name]);

  const initials = useMemo(() => {
    const fn = user?.first_name?.trim()?.[0] ?? "";
    const ln = user?.last_name?.trim()?.[0] ?? "";
    const s = (fn + ln).toUpperCase();
    if (s) return s;
    return (user?.email?.[0] ?? "U").toUpperCase();
  }, [user?.email, user?.first_name, user?.last_name]);

  const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  const avatarSrc = user?.avatar_image_id ? `${baseUrl}/images/${user.avatar_image_id}` : undefined;

  const universityName = useMemo(() => {
    const list = universities.state.value ?? [];
    const uniId = user?.university_id ?? null;
    if (!uniId) return "—";
    return list.find((u) => u.id === uniId)?.name ?? `University #${uniId}`;
  }, [universities.state.value, user?.university_id]);

  const uploadProps: UploadProps = {
    accept: "image/png,image/jpeg",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      setUploading(true);
      try {
        const res = await uploadImage(file as File);
        message.info("Uploading… processing in background");

        // Poll task until SUCCESS/FAILURE (max ~25s)
        for (let i = 0; i < 25; i++) {
          const status = await getImageTask(res.task_id);
          if (status.status === "SUCCESS") {
            if (typeof status.image_id === "number" && Number.isFinite(status.image_id)) {
              await setMyAvatar(status.image_id);
              await hydrateMe();
              message.success("Avatar updated");
              return false;
            }
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
      } catch {
        message.error("Upload failed");
        return false;
      } finally {
        setUploading(false);
      }
    },
  };

  const loading = me.state.loading || universities.state.loading || !user;

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Profile
        </Typography.Title>
        <Space>
          <Button loading={loading} onClick={() => me.run()}>
            Refresh
          </Button>
        </Space>
      </Flex>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 980 }}>
          <Card styles={{ body: { padding: 20 } }}>
            <Flex gap={20} wrap align="stretch">
              <Card
                style={{ flex: "1 1 340px", minWidth: 320 }}
                styles={{ body: { padding: 18 } }}
                bordered={false}
              >
                {loading ? (
                  <Skeleton active avatar paragraph={{ rows: 4 }} />
                ) : (
                  <Space direction="vertical" size={14} style={{ width: "100%" }}>
                    <Flex align="center" justify="space-between" gap={14}>
                      <Flex align="center" gap={14} style={{ minWidth: 0 }}>
                        <Avatar size={72} src={avatarSrc} style={{ backgroundColor: "#1677ff" }}>
                          {initials}
                        </Avatar>
                        <div style={{ minWidth: 0 }}>
                          <Typography.Title level={3} style={{ margin: 0 }} ellipsis>
                            {displayName}
                          </Typography.Title>
                          <Space size={8} wrap>
                            <Tag icon={<SafetyOutlined />} color="blue">
                              {roleLabel(user?.role)}
                            </Tag>
                            {user?.university_id ? (
                              <Tag icon={<BankOutlined />}>{universityName}</Tag>
                            ) : (
                              <Tag>University: —</Tag>
                            )}
                          </Space>
                        </div>
                      </Flex>

                      <Upload {...uploadProps}>
                        <Button icon={<CameraOutlined />} loading={uploading} disabled={uploading}>
                          Upload
                        </Button>
                      </Upload>
                    </Flex>

                    <Divider style={{ margin: "10px 0" }} />

                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      <Flex align="center" gap={10}>
                        <MailOutlined style={{ color: "rgba(0,0,0,0.45)" }} />
                        <Typography.Text ellipsis style={{ minWidth: 0 }}>
                          {user?.email ?? "—"}
                        </Typography.Text>
                      </Flex>
                    </Space>

                  </Space>
                )}
              </Card>

              <Card style={{ flex: "2 1 520px", minWidth: 360 }} styles={{ body: { padding: 18 } }} bordered={false}>
                <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 8 }}>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Personal details
                  </Typography.Title>
                  <Button
                    disabled={loading || !user?.email || resetPassword.state.loading}
                    loading={resetPassword.state.loading}
                    onClick={async () => {
                      try {
                        const email = user?.email;
                        if (!email) return;
                        await resetPassword.run(email);
                        message.success("Password reset link sent to your email");
                      } catch {
                        message.error("Failed to send reset link. Please try again.");
                      }
                    }}
                  >
                    Reset password
                  </Button>
                </Flex>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 8 }} />
                ) : (
                  <Descriptions
                    column={1}
                    size="middle"
                    styles={{ label: { width: 140, color: "rgba(0,0,0,0.45)" } }}
                    items={[
                      { key: "first_name", label: "First name", children: user?.first_name?.trim() || "—" },
                      { key: "last_name", label: "Last name", children: user?.last_name?.trim() || "—" },
                      { key: "email", label: "Email", children: user?.email || "—" },
                    ]}
                  />
                )}
              </Card>
            </Flex>
          </Card>
        </div>
      </div>
    </Page>
  );
}

