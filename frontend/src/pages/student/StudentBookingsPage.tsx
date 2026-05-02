import { Button, Card, Flex, Input, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { cancelBooking, listMyBookings } from "../../features/bookings/api/bookingApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatRange } from "../../shared/utils/dateDisplay";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Booking } from "../../shared/types/domain";

export function StudentBookingsPage() {
  const bookings = useAsync(listMyBookings);
  const cancel = useAsync(cancelBooking);
  const [q, setQ] = useState("");

  useEffect(() => {
    bookings.run({ limit: 50, upcoming: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const items = bookings.state.value ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((b) => formatUserName(b.slot.professor, { id: b.slot.professor_id }).toLowerCase().includes(query));
  }, [bookings.state.value, q]);

  const columns: ColumnsType<Booking> = [
    {
      title: "Title",
      key: "title",
      render: (_, b) =>
        b.slot.description ? (
          <Tooltip title={b.slot.description}>
            <Typography.Text>{b.slot.title}</Typography.Text>
          </Tooltip>
        ) : (
          <Typography.Text>{b.slot.title}</Typography.Text>
        ),
    },
    {
      title: "When",
      key: "when",
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
      title: "Note",
      key: "note",
      render: (_, b) =>
        b.description ? (
          <Typography.Text type="secondary" style={{ fontStyle: "italic" }}>
            {b.description}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "Professor",
      key: "professor",
      render: (_, b) => formatUserName(b.slot.professor, { id: b.slot.professor_id }),
      sorter: (a, b) =>
        formatUserName(a.slot.professor, { id: a.slot.professor_id }).localeCompare(
          formatUserName(b.slot.professor, { id: b.slot.professor_id }),
        ),
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
    {
      title: "",
      key: "actions",
      width: 170,
      render: (_, row) => (
        <Button
          danger
          disabled={cancel.state.loading || dayjs(row.slot.start_time).isBefore(dayjs())}
          onClick={async () => {
            await cancel.run(row.id);
            await bookings.run({ limit: 50, upcoming: false });
          }}
        >
          Cancel
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          My bookings
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
            placeholder="Search professor"
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
          locale={{ emptyText: "No bookings yet. Book a slot to see it here." }}
        />
      </Card>
    </Page>
  );
}

