import { Button, Card, Divider, Flex, Input, List, Select, Space, Switch, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import { listAllBookings } from "../../features/bookings/api/bookingApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatRange } from "../../shared/utils/dateDisplay";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Booking } from "../../shared/types/domain";

type BookingGroup = {
  key: string;
  title: string;
  dateKey: string; // YYYY-MM-DD
  bookings: Booking[];
};

export function AdminBookingsPage() {
  const bookings = useAsync(listAllBookings);
  const [upcoming, setUpcoming] = useState(false);
  const [status, setStatus] = useState<
    "pending" | "approved" | "rejected" | "cancelled" | "booked" | "queued" | "all"
  >("all");
  const [professorId, setProfessorId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    bookings.run({ limit: 100, upcoming });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming]);

  const filtered = useMemo(() => {
    const items = bookings.state.value ?? [];
    return items.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (professorId !== null && b.slot.professor_id !== professorId) return false;
      if (studentId !== null && b.student_id !== studentId) return false;
      if (q.trim()) {
        const query = q.trim().toLowerCase();
        const student = formatUserName(b.student, { id: b.student_id }).toLowerCase();
        const professor = formatUserName(b.slot.professor, { id: b.slot.professor_id }).toLowerCase();
        if (!student.includes(query) && !professor.includes(query)) return false;
      }
      return true;
    });
  }, [bookings.state.value, professorId, q, status, studentId]);

  const grouped = useMemo<BookingGroup[]>(() => {
    const map = new Map<string, BookingGroup>();
    for (const b of filtered) {
      const dateKey = dayjs(b.slot.start_time).format("YYYY-MM-DD");
      const title = b.slot.title ?? "General";
      const key = `${title}_${dateKey}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { key, title, dateKey, bookings: [b] });
      } else {
        existing.bookings.push(b);
      }
    }
    const arr = Array.from(map.values());
    for (const g of arr) {
      g.bookings.sort((a, b) => (a.slot.start_time < b.slot.start_time ? -1 : 1));
    }
    arr.sort((a, b) =>
      a.dateKey !== b.dateKey ? (a.dateKey < b.dateKey ? -1 : 1) : a.title.localeCompare(b.title),
    );
    return arr;
  }, [filtered]);

  const professorOptions = useMemo(() => {
    const items = bookings.state.value ?? [];
    const ids = Array.from(new Set(items.map((b) => b.slot.professor_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((b) => b.slot.professor_id === id) ?? null;
      return { value: id, label: formatUserName(sample?.slot.professor, { id }) };
    });
  }, [bookings.state.value]);

  const studentOptions = useMemo(() => {
    const items = bookings.state.value ?? [];
    const ids = Array.from(new Set(items.map((b) => b.student_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((b) => b.student_id === id) ?? null;
      return { value: id, label: formatUserName(sample?.student, { id }) };
    });
  }, [bookings.state.value]);

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Bookings
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
          <Space>
            <Typography.Text type="secondary">Upcoming</Typography.Text>
            <Switch checked={upcoming} onChange={setUpcoming} />
          </Space>
          <Select
            allowClear
            value={status}
            placeholder="All statuses"
            style={{ minWidth: 160, maxWidth: 240 }}
            options={[
              { label: "All statuses", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
              { label: "Rejected", value: "rejected" },
              { label: "Cancelled", value: "cancelled" },
            ]}
            onChange={(v) => setStatus((v as typeof status) ?? "all")}
          />
          <Select
            allowClear
            showSearch
            placeholder="Professor"
            style={{ minWidth: 180, maxWidth: 260 }}
            value={professorId ?? undefined}
            options={professorOptions}
            optionFilterProp="label"
            onChange={(v) => setProfessorId(typeof v === "number" ? v : null)}
          />
          <Select
            allowClear
            showSearch
            placeholder="Student"
            style={{ minWidth: 180, maxWidth: 260 }}
            value={studentId ?? undefined}
            options={studentOptions}
            optionFilterProp="label"
            onChange={(v) => setStudentId(typeof v === "number" ? v : null)}
          />
          <Input.Search
            placeholder="Search..."
            allowClear
            style={{ minWidth: 200, maxWidth: 260 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => { setStatus("all"); setProfessorId(null); setStudentId(null); setQ(""); }}>
            Clear
          </Button>
          <Button type="primary" loading={bookings.state.loading} onClick={() => bookings.run({ limit: 100, upcoming })}>
            Refresh
          </Button>
        </div>
      </div>
      <Card bodyStyle={{ padding: 16 }}>
        {grouped.length === 0 ? (
          <Typography.Text type="secondary">No bookings match your filters.</Typography.Text>
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {grouped.map((g) => (
              <Card key={g.key} size="small" bodyStyle={{ padding: 14 }}>
                <Flex align="center" justify="space-between" wrap gap={12}>
                  <Space align="baseline" wrap size={8}>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {g.title}
                    </Typography.Title>
                    <Tag>{dayjs(g.dateKey).format("ddd, MMM D")}</Tag>
                  </Space>
                  <Tag color="blue">
                    {g.bookings.length} booking{g.bookings.length === 1 ? "" : "s"}
                  </Tag>
                </Flex>

                <Divider style={{ margin: "12px 0" }} />

                <List
                  size="small"
                  dataSource={g.bookings}
                  renderItem={(b) => {
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
                        <Tag>{String(b.status)}</Tag>
                      );
                    return (
                      <List.Item
                        style={{
                          borderRadius: 10,
                          padding: "10px 10px",
                          border: "1px solid rgba(5,5,5,0.06)",
                          marginBottom: 8,
                          background: isPast ? "#fafafa" : "#fff",
                        }}
                      >
                        <Flex align="center" justify="space-between" wrap gap={10} style={{ width: "100%" }}>
                          <div>
                            <Typography.Text strong>{formatUserName(b.student, { id: b.student_id })}</Typography.Text>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {formatRange(b.slot.start_time, b.slot.end_time)}
                              </Typography.Text>
                              <span style={{ marginLeft: 8 }}>
                                {isPast ? (
                                  <Typography.Text type="secondary">Past</Typography.Text>
                                ) : (
                                  <Typography.Text type="secondary">Upcoming</Typography.Text>
                                )}
                              </span>
                            </div>
                          </div>
                          <Space>
                            {statusTag}
                          </Space>
                        </Flex>
                      </List.Item>
                    );
                  }}
                />
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Page>
  );
}

