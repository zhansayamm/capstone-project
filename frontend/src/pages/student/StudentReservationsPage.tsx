import { Button, Card, DatePicker, Flex, Form, Input, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";

import { listClassrooms } from "../../features/classrooms/api/classroomApi";
import { createReservation, listMyReservations } from "../../features/reservations/api/reservationApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { debugError, debugLog } from "../../shared/utils/debug";
import { formatRange } from "../../shared/utils/dateDisplay";
import { dayjs, dayjsToAppTz } from "../../shared/utils/dayjs";
import { Page } from "../../shared/ui/Page";
import type { Reservation } from "../../shared/types/domain";

type CreateForm = {
  classroom_id: number;
  start: Dayjs;
};

const START_MIN = 8 * 60 + 30; // 08:30
const END_MIN = 17 * 60 + 30; // 17:30
const DURATION_MIN = 60; // exactly 1 hour
const LAST_START_MIN = END_MIN - DURATION_MIN; // 16:30

export function StudentReservationsPage() {
  const classrooms = useAsync(listClassrooms);
  const reservations = useAsync(listMyReservations);
  const create = useAsync(createReservation);
  const [q, setQ] = useState("");
  const [form] = Form.useForm<CreateForm>();
  const start = Form.useWatch("start", form);
  const computedEnd = useMemo(() => (start ? start.add(1, "hour") : null), [start]);

  useEffect(() => {
    classrooms.run();
    reservations.run({ limit: 50, upcoming: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classroomOptions = useMemo(
    () =>
      (classrooms.state.value ?? []).map((c) => ({
        label: `${c.name}${c.capacity ? ` (cap ${c.capacity})` : ""}`,
        value: c.id,
      })),
    [classrooms.state.value],
  );

  const columns: ColumnsType<Reservation> = [
    { title: "Classroom", dataIndex: "classroom_name" },
    {
      title: "When",
      key: "when",
      sorter: (a, b) => (a.start_time < b.start_time ? -1 : 1),
      render: (_, r) => {
        const end = dayjs(r.end_time);
        const isPast = end.isBefore(dayjs());
        return (
          <Space>
            <span>{formatRange(r.start_time, r.end_time)}</span>
            {isPast ? <Tag>Past</Tag> : <Tag color="geekblue">Upcoming</Tag>}
          </Space>
        );
      },
    },
    { title: "Created", dataIndex: "created_at", render: (v) => dayjsToAppTz(v).fromNow() },
  ];

  const filtered = useMemo(() => {
    const items = reservations.state.value ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((r) => (r.classroom_name ?? "").toLowerCase().includes(query));
  }, [q, reservations.state.value]);

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          My reservations
        </Typography.Title>
        <Space>
          <Button loading={reservations.state.loading} onClick={() => reservations.run({ limit: 50, upcoming: false })}>
            Refresh
          </Button>
        </Space>
      </Flex>

      <Card style={{ marginBottom: 16 }} title="Create reservation">
        <Form<CreateForm>
          form={form}
          layout="inline"
          onFinish={async (values) => {
            const st = values.start;
            const end = st.add(1, "hour");
            if (st.isBefore(dayjs())) {
              message.error("Start time must be in the future.");
              return;
            }
            const stMin = st.hour() * 60 + st.minute();
            const endMin = end.hour() * 60 + end.minute();
            if (!st.isSame(end, "day")) {
              message.error("Invalid time. Reservation must be within one day.");
              return;
            }
            if (stMin < START_MIN) {
              message.error("Reservations cannot start before 08:30.");
              return;
            }
            if (stMin > LAST_START_MIN) {
              message.error("Latest start time is 16:30 (1-hour duration).");
              return;
            }
            if (endMin > END_MIN) {
              message.error("Reservations must end before 17:30.");
              return;
            }
            const payload = {
              classroom_id: values.classroom_id,
              start_time: st.toISOString(),
              end_time: end.toISOString(),
            };
            debugLog("[ui] reservation submit", { payload });
            try {
              const res = await create.run(payload);
              debugLog("[api] reservation created", res);
              await reservations.run({ limit: 50, upcoming: false });
            } catch (e) {
              debugError("[api] reservation create failed", e);
              throw e;
            }
          }}
        >
          <Form.Item name="classroom_id" rules={[{ required: true }]} style={{ minWidth: 260 }}>
            <Select
              placeholder="Select classroom"
              loading={classrooms.state.loading}
              options={classroomOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="start" rules={[{ required: true, message: "Select a start time" }]} style={{ minWidth: 320 }}>
            <DatePicker
              showTime
              style={{ width: "100%" }}
              disabledTime={(_) => {
                const disabledHours = () => {
                  const hours: number[] = [];
                  for (let h = 0; h < 24; h++) {
                    if (h < 8 || h > 16) hours.push(h);
                  }
                  return hours;
                };

                const disabledMinutes = (selectedHour: number) => {
                  const mins: number[] = [];
                  for (let m = 0; m < 60; m++) {
                    // enforce step 1 hour at :30 only
                    if (m !== 30) mins.push(m);
                  }
                  // extra guards at boundaries
                  if (selectedHour === 8) {
                    // :30 only already allowed
                  }
                  if (selectedHour === 16) {
                    // :30 only already allowed (latest start)
                  }
                  return mins;
                };

                const disabledSeconds = () => Array.from({ length: 60 }, (_, i) => i).filter((s) => s !== 0);

                return { disabledHours, disabledMinutes, disabledSeconds };
              }}
              disabledDate={(current) => {
                if (!current) return false;
                return current.endOf("day").isBefore(dayjs().startOf("day"));
              }}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={create.state.loading}>
              Reserve
            </Button>
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
          <Typography.Text type="secondary">Available hours: 08:30 – 17:30</Typography.Text>
          <br />
          {start && computedEnd ? (
            <>
              Reservation time:{" "}
              <Typography.Text strong>
                {formatRange(start.toISOString(), computedEnd.toISOString())}
              </Typography.Text>
            </>
          ) : (
            "Select a start time — duration is always 1 hour."
          )}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Reservations are validated for overlaps and must be in the future.
        </Typography.Paragraph>
      </Card>

      <Card>
        <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="Search classroom"
            allowClear
            style={{ width: 280 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Flex>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={reservations.state.loading}
          rowClassName={(row) => (dayjs(row.end_time).isBefore(dayjs()) ? "app-row-past" : "")}
        />
      </Card>
    </Page>
  );
}

