import { Button, Form, Input, Select, Space, Typography } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";

import { CenteredCard } from "../../shared/ui/CenteredCard";
import { useAsync } from "../../shared/hooks/useAsync";
import { listUniversities } from "../../features/auth/api/authApi";
import { useAuthActions } from "../../features/auth/hooks/useAuthActions";
import type { UserRole } from "../../shared/types/auth";

type RegisterForm = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  university_id: number;
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthActions();
  const universities = useAsync(listUniversities);
  const create = useAsync(register);

  useEffect(() => {
    universities.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(
    () =>
      (universities.state.value ?? []).map((u) => ({
        label: u.name,
        value: u.id,
      })),
    [universities.state.value],
  );

  return (
    <CenteredCard title="Create your Booking Time account" width={520}>
      <Form<RegisterForm>
        layout="vertical"
        requiredMark={false}
        onFinish={async (values) => {
          await create.run(values);
          navigate("/login", { replace: true });
        }}
      >
        <Form.Item
          name="first_name"
          label="First name"
          rules={[{ required: true, message: "Enter your first name" }]}
        >
          <Input autoComplete="given-name" placeholder="John" />
        </Form.Item>

        <Form.Item
          name="last_name"
          label="Last name"
          rules={[{ required: true, message: "Enter your last name" }]}
        >
          <Input autoComplete="family-name" placeholder="Doe" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true }, { type: "email", message: "Enter a valid email" }]}
        >
          <Input autoComplete="email" placeholder="you@university.edu" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true },
            { min: 6, message: "Use at least 6 characters" },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="Create a password" />
        </Form.Item>

        <Space size={12} style={{ display: "flex" }}>
          <Form.Item name="role" label="Role" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select
              placeholder="Select role"
              options={[
                { label: "Student", value: "student" },
                { label: "Professor", value: "professor" },
                { label: "Admin", value: "admin" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="university_id"
            label="University"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Select
              placeholder="Select university"
              loading={universities.state.loading}
              options={options}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Space>

        <Button type="primary" htmlType="submit" loading={create.state.loading} block>
          Create account
        </Button>

        <Space style={{ marginTop: 12 }}>
          <Typography.Text type="secondary">Already have an account?</Typography.Text>
          <Link to="/login">Sign in</Link>
        </Space>
      </Form>
    </CenteredCard>
  );
}

