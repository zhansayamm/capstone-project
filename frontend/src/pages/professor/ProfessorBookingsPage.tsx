import { Button, Card, Divider, Flex, Input, List, Modal, Space, Tag, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import { approveBooking, listBookingMessages, listProfessorBookings, postBookingMessage, rejectBooking } from "../../features/bookings/api/bookingApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatRange } from "../../shared/utils/dateDisplay";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { CircleAvatar } from "../../shared/ui/CircleAvatar";
import { Page } from "../../shared/ui/Page";
import type { Booking } from "../../shared/types/domain";

type BookingGroup = {
  key: string;
  title: string;
  description?: string | null;
  dateKey: string; // YYYY-MM-DD
  bookings: Booking[];
};

export function ProfessorBookingsPage() {
  const bookings = useAsync(listProfessorBookings);
  const messages = useAsync(listBookingMessages);
  const postMessage = useAsync(postBookingMessage);
  const [q, setQ] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
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
    return items.filter((b) => {
      const student = formatUserName(b.student, { id: b.student_id }).toLowerCase();
      const title = (b.slot.title ?? "").toLowerCase();
      return student.includes(query) || title.includes(query);
    });
  }, [bookings.state.value, q]);

  const grouped = useMemo<BookingGroup[]>(() => {
    const map = new Map<string, BookingGroup>();
    for (const b of filtered) {
      const dateKey = dayjs(b.slot.start_time).format("YYYY-MM-DD");
      const title = b.slot.title ?? "General";
      const key = `${title}::${dateKey}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          title,
          description: b.slot.description ?? null,
          dateKey,
          bookings: [b],
        });
      } else {
        existing.bookings.push(b);
      }
    }
    const arr = Array.from(map.values());
    for (const g of arr) {
      g.bookings.sort((a, b) => (a.slot.start_time < b.slot.start_time ? -1 : 1));
    }
    arr.sort((a, b) => (a.dateKey !== b.dateKey ? (a.dateKey < b.dateKey ? -1 : 1) : a.title.localeCompare(b.title)));
    return arr;
  }, [filtered]);

  const truncate = (s: string, max = 150) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);

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
      <Card bodyStyle={{ padding: 16 }}>
        <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="Search student or slot title"
            allowClear
            style={{ width: 280 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Flex>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {grouped.length === 0 ? (
            <Typography.Text type="secondary">No bookings yet for your slots.</Typography.Text>
          ) : (
            grouped.map((g) => (
              <Card key={g.key} size="small" bodyStyle={{ padding: 14 }}>
                <Flex align="center" justify="space-between" wrap gap={12}>
                  <div>
                    <Space align="baseline" wrap size={8}>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {g.title}
                      </Typography.Title>
                      <Tag>{dayjs(g.dateKey).format("ddd, MMM D")}</Tag>
                      {dayjs(g.dateKey).isBefore(dayjs().format("YYYY-MM-DD")) ? <Tag>Past</Tag> : <Tag color="geekblue">Upcoming</Tag>}
                    </Space>
                    {g.description ? (
                      <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                        {g.description}
                      </Typography.Paragraph>
                    ) : null}
                  </div>
                  <Tag color="blue">{g.bookings.length} booking{g.bookings.length === 1 ? "" : "s"}</Tag>
                </Flex>

                <Divider style={{ margin: "12px 0" }} />

                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  {g.bookings.map((b) => {
                    const isPast = dayjs(b.slot.end_time).isBefore(dayjs());
                    const statusTag =
                      b.status === "approved" || b.status === "booked" ? (
                        <Tag color="green">Approved</Tag>
                      ) : b.status === "pending" || b.status === "queued" ? (
                        <Tag color="gold">Pending</Tag>
                      ) : b.status === "rejected" ? (
                        <Tag color="red">Rejected</Tag>
                      ) : b.status === "cancelled" ? (
                        <Tag>Cancelled</Tag>
                      ) : (
                        <Tag>{b.status}</Tag>
                      );
                    const initials = (formatUserName(b.student, { id: b.student_id })[0] ?? "S").toUpperCase();
                    return (
                      <Flex
                        key={b.id}
                        align="center"
                        justify="space-between"
                        wrap
                        gap={12}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid rgba(5,5,5,0.06)",
                          borderRadius: 10,
                          background: isPast ? "#fafafa" : "#fff",
                        }}
                      >
                        <Space align="center">
                          <CircleAvatar sizePx={24} alt="" fallback={initials} />
                          <div>
                            <Typography.Text strong>{formatUserName(b.student, { id: b.student_id })}</Typography.Text>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {formatRange(b.slot.start_time, b.slot.end_time)}
                              </Typography.Text>
                            </div>
                            {b.description ? (
                              <div style={{ marginTop: 4 }}>
                                <Tooltip title={b.description}>
                                  <Typography.Text type="secondary" style={{ fontSize: 13, fontStyle: "italic" }}>
                                    {truncate(b.description, 150)}
                                  </Typography.Text>
                                </Tooltip>
                              </div>
                            ) : null}
                          </div>
                        </Space>
                        <Space>
                          {isPast ? <Tag>Past</Tag> : <Tag color="geekblue">Upcoming</Tag>}
                          {statusTag}
                          <Button
                            size="small"
                            onClick={async () => {
                              setChatBooking(b);
                              setChatText("");
                              await messages.run(b.id, { limit: 100, offset: 0 });
                            }}
                          >
                            Chat
                          </Button>
                          {!isPast && (b.status === "pending" || b.status === "queued") ? (
                            <>
                              <Button
                                size="small"
                                type="primary"
                                loading={actionLoadingId === b.id}
                                onClick={async () => {
                                  setActionLoadingId(b.id);
                                  try {
                                    await approveBooking(b.id);
                                    await bookings.run({ limit: 50, upcoming: false });
                                  } finally {
                                    setActionLoadingId(null);
                                  }
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                danger
                                loading={actionLoadingId === b.id}
                                onClick={async () => {
                                  setActionLoadingId(b.id);
                                  try {
                                    await rejectBooking(b.id);
                                    await bookings.run({ limit: 50, upcoming: false });
                                  } finally {
                                    setActionLoadingId(null);
                                  }
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </Space>
                      </Flex>
                    );
                  })}
                </Space>
              </Card>
            ))
          )}
        </Space>
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

