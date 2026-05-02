import { Button, Card, Flex, Input, List, Modal, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { cancelBooking, listBookingMessages, listMyBookings, postBookingMessage } from "../../features/bookings/api/bookingApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatRange } from "../../shared/utils/dateDisplay";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Booking } from "../../shared/types/domain";

export function StudentBookingsPage() {
  const bookings = useAsync(listMyBookings);
  const cancel = useAsync(cancelBooking);
  const messages = useAsync(listBookingMessages);
  const postMessage = useAsync(postBookingMessage);
  const [q, setQ] = useState("");
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  const [chatText, setChatText] = useState("");

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
      render: (s) =>
        s === "approved" || s === "booked" ? (
          <Tag color="green">Approved</Tag>
        ) : s === "pending" || s === "queued" ? (
          <Tag color="gold">Pending</Tag>
        ) : s === "rejected" ? (
          <Tag color="red">Rejected</Tag>
        ) : s === "cancelled" ? (
          <Tag>Cancelled</Tag>
        ) : (
          <Tag>{String(s)}</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 240,
      render: (_, row) => (
        <Space>
          <Button
            onClick={async () => {
              setChatBooking(row);
              setChatText("");
              await messages.run(row.id, { limit: 100, offset: 0 });
            }}
          >
            Chat
          </Button>
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
        </Space>
      ),
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          My bookings
        </Typography.Title>
      </Flex>
      <Card>
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
            <Input.Search
              placeholder="Search..."
              allowClear
              style={{ minWidth: 200, maxWidth: 260 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => setQ("")}>Clear</Button>
            <Button type="primary" loading={bookings.state.loading} onClick={() => bookings.run({ limit: 50, upcoming: false })}>
              Refresh
            </Button>
          </div>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={bookings.state.loading}
          rowClassName={(row) => (dayjs(row.slot.end_time).isBefore(dayjs()) ? "app-row-past" : "")}
          locale={{ emptyText: "No bookings yet. Book a slot to see it here." }}
        />
      </Card>

      <Modal
        title={chatBooking ? `Booking chat · ${chatBooking.slot.title}` : "Booking chat"}
        open={!!chatBooking}
        onCancel={() => {
          setChatBooking(null);
          setChatText("");
        }}
        footer={null}
        width={640}
      >
        <List
          size="small"
          loading={messages.state.loading}
          dataSource={messages.state.value ?? []}
          locale={{ emptyText: "No messages yet." }}
          renderItem={(m) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space size={8} wrap>
                    <Typography.Text strong>{formatUserName(m.sender, { id: m.sender_id })}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(m.created_at).format("MMM D, HH:mm")}
                    </Typography.Text>
                  </Space>
                }
                description={<Typography.Text>{m.message}</Typography.Text>}
              />
            </List.Item>
          )}
          style={{ maxHeight: 360, overflow: "auto", border: "1px solid rgba(5,5,5,0.06)", borderRadius: 8, padding: 8 }}
        />

        <div style={{ marginTop: 12 }}>
          <Input.TextArea
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Write a message…"
          />
          <Flex justify="flex-end" style={{ marginTop: 8 }}>
            <Button
              type="primary"
              loading={postMessage.state.loading}
              disabled={!chatBooking || !chatText.trim()}
              onClick={async () => {
                if (!chatBooking) return;
                const text = chatText.trim();
                setChatText("");
                await postMessage.run(chatBooking.id, text);
                await messages.run(chatBooking.id, { limit: 100, offset: 0 });
              }}
            >
              Send
            </Button>
          </Flex>
        </div>
      </Modal>
    </Page>
  );
}

