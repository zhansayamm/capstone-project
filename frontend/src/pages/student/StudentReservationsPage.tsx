import { Button, Card, DatePicker, Flex, Form, Input, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";

import { listClassrooms } from "../../features/classrooms/api/classroomApi";
import { createReservation, listMyReservations } from "../../features/reservations/api/reservationApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatRange } from "../../shared/utils/dateDisplay";
import { disabledTimeForBusinessHours, isWithinBusinessHours } from "../../shared/utils/businessHours";
import { dayjs } from "../../shared/utils/dayjs";
import { Page } from "../../shared/ui/Page";
import type { Reservation } from "../../shared/types/domain";

type CreateForm = {
  classroom_id: number;
  range: [Dayjs, Dayjs];
};

export function StudentReservationsPage() {
  const classrooms = useAsync(listClassrooms);
  const reservations = useAsync(listMyReservations);
  const create = useAsync(createReservation);
  const [q, setQ] = useState("");

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
    { title: "Created", dataIndex: "created_at", render: (v) => dayjs(v).fromNow() },
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
          layout="inline"
          onFinish={async (values) => {
            const [start, end] = values.range ?? [];
            if (!isWithinBusinessHours([start, end])) {
              message.error("Reservations must be within 08:30–17:30.");
              return;
            }
            await create.run({
              classroom_id: values.classroom_id,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
            });
            await reservations.run({ limit: 50, upcoming: false });
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
          <Form.Item name="range" rules={[{ required: true }]} style={{ minWidth: 360 }}>
            <DatePicker.RangePicker
              showTime
              disabledTime={disabledTimeForBusinessHours}
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

