import { Button, Card, Flex, Form, Input, InputNumber, Modal, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import {
  createClassroom,
  deleteClassroom,
  listClassrooms,
  updateClassroom,
} from "../../features/classrooms/api/classroomApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { Page } from "../../shared/ui/Page";
import type { Classroom } from "../../shared/types/domain";

type CreateForm = { name: string; capacity?: number | null };
type EditForm = { name: string; capacity?: number | null };

export function AdminClassroomsPage() {
  const classrooms = useAsync(listClassrooms);
  const create = useAsync(createClassroom);
  const update = useAsync(updateClassroom);
  const remove = useAsync(deleteClassroom);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Classroom | null>(null);
  const [editTarget, setEditTarget] = useState<Classroom | null>(null);
  const [form] = Form.useForm<CreateForm>();
  const [editForm] = Form.useForm<EditForm>();

  useEffect(() => {
    classrooms.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = classrooms.state.value ?? [];
    if (!q) return items;
    return items.filter((c) => c.name.toLowerCase().includes(q));
  }, [classrooms.state.value, query]);

  const openEdit = (row: Classroom) => {
    setEditTarget(row);
    editForm.setFieldsValue({
      name: row.name,
      capacity: row.capacity ?? undefined,
    });
  };

  const columns: ColumnsType<Classroom> = [
    { title: "Name", dataIndex: "name" },
    { title: "Capacity", dataIndex: "capacity", render: (v) => v ?? "—" },
    {
      title: "",
      key: "actions",
      width: 220,
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            disabled={update.state.loading}
            onClick={() => openEdit(row)}
          >
            Edit
          </Button>
          <Button
            danger
            disabled={remove.state.loading}
            onClick={() => setDeleteTarget(row)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Classrooms
        </Typography.Title>
        <Space>
          <Input placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button loading={classrooms.state.loading} onClick={() => classrooms.run()}>
            Refresh
          </Button>
        </Space>
      </Flex>

      <Card style={{ marginBottom: 16 }} title="Create classroom">
        <Form<CreateForm>
          form={form}
          layout="inline"
          onFinish={async (values) => {
            const name = values.name.trim();
            const cap = values.capacity ?? null;
            await create.run({ name, capacity: cap });
            message.success("Classroom created");
            form.resetFields();
            await classrooms.run();
          }}
        >
          <Form.Item
            name="name"
            rules={[
              { required: true, message: "Enter a classroom name" },
              {
                validator: async (_, v) => {
                  if (typeof v !== "string" || !v.trim()) throw new Error("Enter a classroom name");
                },
              },
            ]}
            style={{ minWidth: 280 }}
          >
            <Input placeholder="e.g. Room 101" />
          </Form.Item>
          <Form.Item name="capacity">
            <InputNumber placeholder="Capacity" min={1} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={create.state.loading}>
              Create
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={classrooms.state.loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: "No classrooms match your search." }}
        />
      </Card>

      <Modal
        title="Delete classroom"
        open={!!deleteTarget}
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: remove.state.loading }}
        onCancel={() => setDeleteTarget(null)}
        onOk={async () => {
          if (!deleteTarget) return;
          try {
            await remove.run(deleteTarget.id);
            message.success("Classroom deleted");
            setDeleteTarget(null);
            await classrooms.run();
          } catch {
            message.error("Failed to delete classroom");
          }
        }}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Are you sure you want to delete this classroom? This will permanently remove{" "}
          <Typography.Text strong>{deleteTarget?.name}</Typography.Text>.
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="Edit classroom"
        open={!!editTarget}
        okText="Save"
        cancelText="Cancel"
        confirmLoading={update.state.loading}
        onCancel={() => {
          setEditTarget(null);
          editForm.resetFields();
        }}
        onOk={async () => {
          if (!editTarget) return;
          let values: EditForm;
          try {
            values = await editForm.validateFields();
          } catch {
            return;
          }
          const name = values.name.trim();
          const cap = values.capacity ?? null;
          try {
            await update.run(editTarget.id, { name, capacity: cap });
            message.success("Classroom updated");
            setEditTarget(null);
            editForm.resetFields();
            await classrooms.run();
          } catch {
            message.error("Failed to update classroom");
          }
        }}
      >
        <Form<EditForm> form={editForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, message: "Enter a classroom name" },
              {
                validator: async (_, v) => {
                  if (typeof v !== "string" || !v.trim()) throw new Error("Enter a classroom name");
                },
              },
            ]}
          >
            <Input placeholder="e.g. Room 101" />
          </Form.Item>
          <Form.Item name="capacity" label="Capacity" rules={[{ required: true, message: "Capacity required" }]}>
            <InputNumber placeholder="Capacity" min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

