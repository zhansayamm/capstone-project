import {
  Badge,
  Button,
  Calendar,
  Card,
  DatePicker,
  Divider,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";

import { createSlot, deleteSlot, listMySlots } from "../../features/slots/api/slotApi";
import { CircleAvatar } from "../../shared/ui/CircleAvatar";
import { useAsync } from "../../shared/hooks/useAsync";
import { disabledTimeForBusinessHours, isWithinBusinessHours } from "../../shared/utils/businessHours";
import { formatDateTime } from "../../shared/utils/dateDisplay";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Slot } from "../../shared/types/domain";

type CreateForm = {
  title: string;
  description?: string | null;
  range: [Dayjs, Dayjs];
  duration_minutes: 15 | 30 | 60;
};

type SlotGroup = {
  key: string;
  title: string;
  description?: string | null;
  dateKey: string; // YYYY-MM-DD
  slots: Slot[];
};

export function ProfessorSlotsPage() {
  const slots = useAsync(listMySlots);
  const create = useAsync(createSlot);
  const remove = useAsync(deleteSlot);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [form] = Form.useForm<CreateForm>();
  const [viewSlot, setViewSlot] = useState<Slot | null>(null);

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
  const grouped = useMemo<SlotGroup[]>(() => {
    const map = new Map<string, SlotGroup>();
    for (const s of slots.state.value ?? []) {
      const dateKey = dayjs(s.start_time).format("YYYY-MM-DD");
      const title = s.title ?? "General";
      const key = `${title}::${dateKey}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          title,
          description: s.description ?? null,
          dateKey,
          slots: [s],
        });
      } else {
        existing.slots.push(s);
      }
    }
    const arr = Array.from(map.values());
    for (const g of arr) {
      g.slots.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
    }
    arr.sort((a, b) => (a.dateKey !== b.dateKey ? (a.dateKey < b.dateKey ? -1 : 1) : a.title.localeCompare(b.title)));
    return arr;
  }, [slots.state.value]);

  const selectedGroups = useMemo(() => grouped.filter((g) => g.dateKey === selectedKey), [grouped, selectedKey]);
  const allGroups = grouped;

  const deleteSlotById = async (slotId: number) => {
    await remove.run(slotId);
    await slots.run();
  };

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          My slots
        </Typography.Title>
      </Flex>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, flex: 1 }}>
          {/* (No filters here yet, but keep consistent bar for future) */}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => setCreateOpen(true)}>Create slot</Button>
          <Button type="primary" loading={slots.state.loading} onClick={() => slots.run()}>
            Refresh
          </Button>
        </div>
      </div>

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
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {selectedGroups.length === 0 ? (
                <Card>
                  <Typography.Text type="secondary">No slots for this day. Create one from the button above.</Typography.Text>
                </Card>
              ) : (
                selectedGroups.map((g) => (
                  <Card key={g.key} size="small" bodyStyle={{ padding: 14 }}>
                    <Flex align="center" justify="space-between" wrap gap={10}>
                      <div>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                          {g.title}
                        </Typography.Title>
                        {g.description ? (
                          <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                            {g.description}
                          </Typography.Paragraph>
                        ) : null}
                      </div>
                      <Tag color="blue">{g.slots.length} slot{g.slots.length === 1 ? "" : "s"}</Tag>
                    </Flex>

                    <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 12 }}>
                      {g.slots.map((s) => (
                        <Flex
                          key={s.id}
                          align="center"
                          justify="space-between"
                          wrap
                          gap={12}
                          style={{
                            padding: "8px 10px",
                            border: "1px solid rgba(5,5,5,0.06)",
                            borderRadius: 10,
                            background: s.is_booked ? "#fff7e6" : "#f6ffed",
                          }}
                        >
                          <Space>
                            <Typography.Text strong>
                              {dayjs(s.start_time).format("HH:mm")}–{dayjs(s.end_time).format("HH:mm")}
                            </Typography.Text>
                            {s.is_booked ? <Tag color="orange">Booked</Tag> : <Tag color="green">Available</Tag>}
                            {s.is_booked && s.booked_by ? (
                              <Space size={6} align="center">
                                <CircleAvatar
                                  sizePx={24}
                                  alt=""
                                  fallback={(formatUserName(s.booked_by, { email: s.booked_by.email })[0] ?? "S").toUpperCase()}
                                />
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatUserName(s.booked_by, { email: s.booked_by.email })}
                                </Typography.Text>
                                <Button size="small" type="link" onClick={() => setViewSlot(s)}>
                                  View
                                </Button>
                              </Space>
                            ) : null}
                          </Space>
                          <Popconfirm
                            title="Delete this slot?"
                            description="This only deletes this specific time."
                            okText="Delete"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => deleteSlotById(s.id)}
                          >
                            <Button danger size="small" disabled={remove.state.loading}>
                              Delete
                            </Button>
                          </Popconfirm>
                        </Flex>
                      ))}
                    </Space>
                  </Card>
                ))
              )}
            </Space>
          </div>
        </Flex>
      </Card>

      <Card title="All slots (grouped)">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {allGroups.length === 0 ? (
            <Typography.Text type="secondary">No slots yet. Create your first slot.</Typography.Text>
          ) : (
            allGroups.map((g) => (
              <Card key={g.key} size="small" bodyStyle={{ padding: 14 }}>
                <Flex align="center" justify="space-between" wrap gap={10}>
                  <div>
                    <Space align="baseline" wrap size={8}>
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {g.title}
                      </Typography.Title>
                      <Tag>{dayjs(g.dateKey).format("ddd, MMM D")}</Tag>
                    </Space>
                    {g.description ? (
                      <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                        {g.description}
                      </Typography.Paragraph>
                    ) : null}
                  </div>
                  <Tag color="blue">{g.slots.length} slot{g.slots.length === 1 ? "" : "s"}</Tag>
                </Flex>

                <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 12 }}>
                  {g.slots.map((s) => (
                    <Flex
                      key={s.id}
                      align="center"
                      justify="space-between"
                      wrap
                      gap={12}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid rgba(5,5,5,0.06)",
                        borderRadius: 10,
                        background: s.is_booked ? "#fff7e6" : "#f6ffed",
                      }}
                    >
                      <Space>
                        <Typography.Text strong>
                          {dayjs(s.start_time).format("HH:mm")}–{dayjs(s.end_time).format("HH:mm")}
                        </Typography.Text>
                        {s.is_booked ? <Tag color="orange">Booked</Tag> : <Tag color="green">Available</Tag>}
                        {s.is_booked && s.booked_by ? (
                          <Space size={6} align="center">
                            <CircleAvatar
                              sizePx={24}
                              alt=""
                              fallback={(formatUserName(s.booked_by, { email: s.booked_by.email })[0] ?? "S").toUpperCase()}
                            />
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {formatUserName(s.booked_by, { email: s.booked_by.email })}
                            </Typography.Text>
                            <Button size="small" type="link" onClick={() => setViewSlot(s)}>
                              View
                            </Button>
                          </Space>
                        ) : null}
                      </Space>
                      <Popconfirm
                        title="Delete this slot?"
                        description="This only deletes this specific time."
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteSlotById(s.id)}
                      >
                        <Button danger size="small" disabled={remove.state.loading}>
                          Delete
                        </Button>
                      </Popconfirm>
                    </Flex>
                  ))}
                </Space>
              </Card>
            ))
          )}
        </Space>
      </Card>

      <Modal
        title="Slot details"
        open={!!viewSlot}
        footer={[
          <Button key="close" onClick={() => setViewSlot(null)}>
            Close
          </Button>,
        ]}
        onCancel={() => setViewSlot(null)}
      >
        {viewSlot ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Text strong>{viewSlot.title}</Typography.Text>
            {viewSlot.description ? <Typography.Text type="secondary">{viewSlot.description}</Typography.Text> : null}
            <Typography.Text>
              Time: {formatDateTime(viewSlot.start_time)} – {formatDateTime(viewSlot.end_time)}
            </Typography.Text>
            <Divider style={{ margin: "10px 0" }} />
            <Typography.Text strong>Student</Typography.Text>
            {viewSlot.booked_by ? (
              <Space align="center">
                <CircleAvatar
                  sizePx={40}
                  alt=""
                  fallback={(formatUserName(viewSlot.booked_by, { email: viewSlot.booked_by.email })[0] ?? "S").toUpperCase()}
                />
                <div>
                  <div>
                    <Typography.Text>{formatUserName(viewSlot.booked_by, { email: viewSlot.booked_by.email })}</Typography.Text>
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {viewSlot.booked_by.email}
                  </Typography.Text>
                </div>
              </Space>
            ) : (
              <Typography.Text type="secondary">Not booked</Typography.Text>
            )}
            {viewSlot.booking_description ? (
              <>
                <Divider style={{ margin: "10px 0" }} />
                <Typography.Text strong>Student note</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontStyle: "italic" }}>
                  {viewSlot.booking_description}
                </Typography.Paragraph>
              </>
            ) : null}
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="Create slot"
        open={createOpen}
        okText="Create"
        confirmLoading={create.state.loading}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          const [start, end] = values.range;
          const duration = values.duration_minutes ?? 30;
          const title = values.title;
          const description = values.description ?? null;
          const now = dayjs();
          if (start.isBefore(now)) {
            message.error("Start time must be in the future.");
            return;
          }
          if (!isWithinBusinessHours([start, end])) {
            message.error("Slots must be within 08:30–17:30.");
            return;
          }
          const created = await create.run({
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            duration_minutes: duration,
            title,
            description,
          });
          message.success(`Created ${created.length} slot${created.length === 1 ? "" : "s"}`);
          setCreateOpen(false);
          form.resetFields();
          await slots.run();
        }}
      >
        <Form<CreateForm> form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="title"
            label="Title"
            rules={[
              { required: true, message: "Enter a title" },
              { min: 3, max: 100, message: "Title must be 3–100 characters" },
            ]}
          >
            <Input placeholder="e.g. Final Project Defense" />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={3} placeholder="Optional details for students…" maxLength={500} />
          </Form.Item>
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
          <Form.Item
            name="duration_minutes"
            label="Slot duration"
            initialValue={30}
            rules={[{ required: true, message: "Select duration" }]}
          >
            <Select
              options={[
                { value: 15, label: "15 minutes" },
                { value: 30, label: "30 minutes" },
                { value: 60, label: "1 hour" },
              ]}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            This will automatically split the range into bookable mini-slots (validated by backend).
          </Typography.Paragraph>
        </Form>
      </Modal>
    </Page>
  );
}

