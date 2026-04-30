import {
  Badge,
  Button,
  Calendar,
  Card,
  DatePicker,
  Flex,
  Form,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";

import { createSlot, deleteSlot, listMySlots } from "../../features/slots/api/slotApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { disabledTimeForBusinessHours, isWithinBusinessHours } from "../../shared/utils/businessHours";
import { formatDateTime } from "../../shared/utils/dateDisplay";
import { dayjs } from "../../shared/utils/dayjs";
import { Page } from "../../shared/ui/Page";
import type { Slot } from "../../shared/types/domain";

type CreateForm = { range: [Dayjs, Dayjs] };

export function ProfessorSlotsPage() {
  const slots = useAsync(listMySlots);
  const create = useAsync(createSlot);
  const remove = useAsync(deleteSlot);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [form] = Form.useForm<CreateForm>();

  useEffect(() => {
    slots.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots.state.value ?? []) {
      const key = dayjs(s.start_time).format("YYYY-MM-DD");
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [slots.state.value]);

  const selectedKey = selectedDate.format("YYYY-MM-DD");
  const selectedSlots = (byDay.get(selectedKey) ?? []).slice().sort((a, b) => (a.start_time < b.start_time ? -1 : 1));

  const columns: ColumnsType<Slot> = [
    { title: "Start", dataIndex: "start_time", render: (v) => formatDateTime(v) },
    { title: "End", dataIndex: "end_time", render: (v) => formatDateTime(v) },
    {
      title: "Status",
      dataIndex: "is_booked",
      render: (isBooked) => (isBooked ? <Tag color="orange">Booked</Tag> : <Tag color="green">Available</Tag>),
    },
    {
      title: "",
      key: "actions",
      width: 160,
      render: (_, row) => (
        <Button
          danger
          disabled={remove.state.loading}
          onClick={async () => {
            await remove.run(row.id);
            await slots.run();
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          My slots
        </Typography.Title>
        <Space>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Create slot
          </Button>
          <Button loading={slots.state.loading} onClick={() => slots.run()}>
            Refresh
          </Button>
        </Space>
      </Flex>

      <Card style={{ marginBottom: 16 }}>
        <Flex wrap gap={16} align="start">
          <div style={{ flex: "1 1 360px", minWidth: 320 }}>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              Calendar
            </Typography.Title>
            <Calendar
              fullscreen={false}
              value={selectedDate}
              onSelect={(d) => setSelectedDate(d)}
              dateCellRender={(value) => {
                const key = value.format("YYYY-MM-DD");
                const count = byDay.get(key)?.length ?? 0;
                if (count === 0) return null;
                return (
                  <div style={{ paddingTop: 6 }}>
                    <Badge count={count} color="#1677ff" />
                  </div>
                );
              }}
            />
          </div>
          <div style={{ flex: "2 1 520px", minWidth: 360 }}>
            <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Slots on {selectedDate.format("YYYY-MM-DD")}
              </Typography.Title>
              <Space>
                <Tag color="green">Available</Tag>
                <Tag color="orange">Booked</Tag>
              </Space>
            </Flex>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={selectedSlots}
              loading={slots.state.loading}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: "No slots for this day. Create one from the button above." }}
            />
          </div>
        </Flex>
      </Card>

      <Card title="All slots">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={(slots.state.value ?? []).slice().sort((a, b) => (a.start_time < b.start_time ? -1 : 1))}
          loading={slots.state.loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: "No slots yet. Create your first slot." }}
        />
      </Card>

      <Modal
        title="Create slot"
        open={createOpen}
        okText="Create"
        confirmLoading={create.state.loading}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          const [start, end] = values.range;
          const now = dayjs();
          if (start.isBefore(now)) {
            message.error("Start time must be in the future.");
            return;
          }
          if (!isWithinBusinessHours([start, end])) {
            message.error("Slots must be within 08:30–17:30.");
            return;
          }
          await create.run({ start_time: start.toISOString(), end_time: end.toISOString() });
          message.success("Slot created");
          setCreateOpen(false);
          form.resetFields();
          await slots.run();
        }}
      >
        <Form<CreateForm> form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="range" label="Date & time" rules={[{ required: true, message: "Select a time range" }]}>
            <DatePicker.RangePicker
              showTime
              style={{ width: "100%" }}
              disabledDate={(current) => {
                if (!current) return false;
                return current.endOf("day").isBefore(dayjs().startOf("day"));
              }}
              disabledTime={disabledTimeForBusinessHours}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Past dates are disabled. Slots must be in the future and cannot overlap existing slots (validated by backend).
          </Typography.Paragraph>
        </Form>
      </Modal>
    </Page>
  );
}

