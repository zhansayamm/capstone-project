import { Button, Form, Input, Space, Typography, message } from "antd";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";

import { useAsync } from "../../shared/hooks/useAsync";
import { CenteredCard } from "../../shared/ui/CenteredCard";
import { useAuthActions } from "../../features/auth/hooks/useAuthActions";
import { defaultRouteForRole } from "../../shared/utils/roleRedirect";
import { useAuthStore } from "../../features/auth/store/useAuthStore";

type LoginForm = { email: string; password: string };

type ApiErrorResponse = { message?: string; detail?: string; error?: string };

function getApiErrorMessage(err: unknown): string {
  const e = err as AxiosError<ApiErrorResponse>;
  const data = e.response?.data;
  return (
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.detail === "string" && data.detail) ||
    (typeof data?.error === "string" && data.error) ||
    "Login failed"
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthActions();
  const { state, run } = useAsync(login);
  const hydrated = useAuthStore((s) => s.hydrated);
  const authReady = useAuthStore((s) => s.authReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const loading = !hydrated || !authReady;

  useEffect(() => {
    console.log("USER:", user, "LOADING:", loading, "PATH:", location.pathname);
  }, [user, loading, location.pathname]);

  /* Already logged in (e.g. stored session): go to role dashboard — do not use `next`. */
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user?.role) return;
    const target = defaultRouteForRole(user.role);
    console.log("USER:", user, "LOADING:", loading, "PATH:", location.pathname, "→ redirect", target);
    navigate(target, { replace: true });
  }, [loading, isAuthenticated, user, navigate, location.pathname]);

  return (
    <CenteredCard title="Sign in to Booking Time">
      <Form<LoginForm>
        layout="vertical"
        requiredMark={false}
        onFinish={async (values) => {
          console.debug("[ui] login submit", values);
          try {
            const me = await run(values);
            const target = defaultRouteForRole(me.role);
            console.log("USER:", me, "LOADING:", false, "PATH:", location.pathname, "→ redirect", target);
            navigate(target, { replace: true });
          } catch (e: unknown) {
            message.error(getApiErrorMessage(e));
          }
        }}
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true }, { type: "email", message: "Enter a valid email" }]}
        >
          <Input autoComplete="email" placeholder="you@university.edu" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" placeholder="Your password" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={state.loading} block>
          Sign in
        </Button>

        <Space style={{ marginTop: 12 }}>
          <Typography.Text type="secondary">No account?</Typography.Text>
          <Link to="/register">Create one</Link>
        </Space>
      </Form>
    </CenteredCard>
  );
}

