import { LockOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { resetPassword } from "../../shared/api/modules/authApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { debugError, debugLog } from "../../shared/utils/debug";

type ResetPasswordForm = {
  new_password: string;
  confirm_password: string;
};

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const submit = useAsync(resetPassword);

  const tokenMissing = useMemo(() => token.trim().length === 0, [token]);

  return (
    <div style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, padding: 16 }}>
        <Card styles={{ body: { padding: 22 } }}>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
            Reset password
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            Enter a new password for your account.
          </Typography.Paragraph>

          {tokenMissing ? (
            <>
              <Typography.Paragraph style={{ marginBottom: 16 }}>
                This reset link is invalid or missing a token. Please request a new password reset email.
              </Typography.Paragraph>
              <Button type="primary" onClick={() => navigate("/login")} block>
                Back to login
              </Button>
            </>
          ) : (
            <Form<ResetPasswordForm>
              layout="vertical"
              requiredMark={false}
              onFinish={async (values) => {
                try {
                  debugLog("[ui] reset password submit", { token_len: token.length });
                  await submit.run({ token, new_password: values.new_password });
                  debugLog("[api] reset password ok");
                  message.success("Password successfully reset");
                  navigate("/login", { replace: true });
                } catch {
                  debugError("[api] reset password failed");
                  message.error("Invalid or expired token. Please request a new reset link.");
                }
              }}
            >
              <Form.Item
                name="new_password"
                label="New password"
                rules={[
                  { required: true, message: "Enter a new password" },
                  { min: 6, message: "Password must be at least 6 characters" },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="New password" autoComplete="new-password" />
              </Form.Item>

              <Form.Item
                name="confirm_password"
                label="Confirm password"
                dependencies={["new_password"]}
                rules={[
                  { required: true, message: "Confirm your new password" },
                  ({ getFieldValue }) => ({
                    validator: async (_, value: string) => {
                      if (!value || getFieldValue("new_password") === value) return;
                      throw new Error("Passwords do not match");
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Confirm password" autoComplete="new-password" />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={submit.state.loading} disabled={submit.state.loading} block>
                Reset password
              </Button>
            </Form>
          )}
        </Card>
      </div>
    </div>
  );
}

