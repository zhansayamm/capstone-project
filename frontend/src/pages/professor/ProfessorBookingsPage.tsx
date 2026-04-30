import { Button, Card, Flex, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { listProfessorBookings } from "../../features/bookings/api/bookingApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatRange } from "../../shared/utils/dateDisplay";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Booking } from "../../shared/types/domain";

export function ProfessorBookingsPage() {
  const bookings = useAsync(listProfessorBookings);
  const [q, setQ] = useState("");

  useEffect(() => {
    bookings.run({ limit: 50, upcoming: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const items = bookings.state.value ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((b) => formatUserName(b.student, { id: b.student_id }).toLowerCase().includes(query));
  }, [bookings.state.value, q]);

  const columns: ColumnsType<Booking> = [
    {
      title: "Student",
      key: "student",
      render: (_, b) => formatUserName(b.student, { id: b.student_id }),
      sorter: (a, b) =>
        formatUserName(a.student, { id: a.student_id }).localeCompare(formatUserName(b.student, { id: b.student_id })),
    },
    {
      title: "When",
      key: "when",
      sorter: (a, b) => (a.slot.start_time < b.slot.start_time ? -1 : 1),
      render: (_, b) => {
        const end = dayjs(b.slot.end_time);
        const isPast = end.isBefore(dayjs());
        return (
          <Space>
            <span>{formatRange(b.slot.start_time, b.slot.end_time)}</span>
            {isPast ? <Tag>Past</Tag> : <Tag color="geekblue">Upcoming</Tag>}
          </Space>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s, row) =>
        s === "booked" ? (
          <Tag color="green">Booked</Tag>
        ) : (
          <Tag color="blue">Queued{row.queue_position ? ` (#${row.queue_position})` : ""}</Tag>
        ),
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Bookings for my slots
        </Typography.Title>
        <Space>
          <Button loading={bookings.state.loading} onClick={() => bookings.run({ limit: 50, upcoming: false })}>
            Refresh
          </Button>
        </Space>
      </Flex>
      <Card>
        <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="Search student"
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
          loading={bookings.state.loading}
          rowClassName={(row) => (dayjs(row.slot.end_time).isBefore(dayjs()) ? "app-row-past" : "")}
          locale={{ emptyText: "No bookings yet for your slots." }}
        />
      </Card>
    </Page>
  );
}

