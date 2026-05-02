import { Card, Col, Flex, Row, Select, Space, Table, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getBookingStats,
  getTopClassrooms,
  getTopProfessors,
  getTotals,
  type BookingByStatus,
} from "../../features/admin/api/adminApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { Page } from "../../shared/ui/Page";

const COLORS = ["#faad14", "#52c41a", "#ff4d4f", "#8c8c8c", "#1677ff", "#9254de"];

const BY_STATUS_ROWS: Array<{ key: keyof BookingByStatus; label: string }> = [
  { key: "pending", label: "Pending (awaiting professor)" },
  { key: "queued", label: "Queued (legacy)" },
  { key: "approved", label: "Approved" },
  { key: "booked", label: "Booked (legacy)" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

export function AdminAnalyticsPage() {
  const totals = useAsync(getTotals);
  const bookingStats = useAsync(getBookingStats);
  const topProfessors = useAsync(getTopProfessors);
  const topClassrooms = useAsync(getTopClassrooms);

  const [topN, setTopN] = useState(5);

  useEffect(() => {
    totals.run();
    bookingStats.run();
    topProfessors.run();
    topClassrooms.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bookingPieData = useMemo(() => {
    const r = bookingStats.state.value?.rollup;
    if (!r) return [];
    return [
      { name: "Awaiting review", value: r.awaiting_review },
      { name: "Confirmed", value: r.confirmed },
      { name: "Rejected", value: r.rejected },
      { name: "Cancelled", value: r.cancelled },
    ].filter((d) => d.value > 0);
  }, [bookingStats.state.value]);

  const bookingStatusRows = useMemo(() => {
    const raw = bookingStats.state.value?.by_status;
    if (!raw) return [];
    return BY_STATUS_ROWS.map((row) => ({
      status: row.label,
      rawKey: row.key,
      count: raw[row.key],
    }));
  }, [bookingStats.state.value]);

  const topProfessorData = useMemo(() => {
    const rows = topProfessors.state.value ?? [];
    return rows.slice(0, topN).map((r) => ({
      name: r.professor_name?.trim() || `Professor #${r.professor_id}`,
      slots_created: r.slots_created,
    }));
  }, [topN, topProfessors.state.value]);

  const topClassroomData = useMemo(() => {
    const rows = topClassrooms.state.value ?? [];
    return rows.slice(0, topN).map((r) => ({
      name: r.classroom_name?.trim() || `Classroom #${r.classroom_id}`,
      reservations: r.reservations,
    }));
  }, [topN, topClassrooms.state.value]);

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Analytics
        </Typography.Title>
        <Space>
          <Typography.Text type="secondary">Top N</Typography.Text>
          <Select
            value={topN}
            style={{ width: 110 }}
            options={[5, 10, 15].map((n) => ({ label: `${n}`, value: n }))}
            onChange={setTopN}
          />
        </Space>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card title="Totals">
            <Space direction="vertical" size={6}>
              <Typography.Text>Users: {totals.state.value?.total_users ?? "—"}</Typography.Text>
              <Typography.Text>Slots: {totals.state.value?.total_slots ?? "—"}</Typography.Text>
              <Typography.Text>Bookings: {totals.state.value?.total_bookings ?? "—"}</Typography.Text>
              <Typography.Text>Reservations: {totals.state.value?.total_reservations ?? "—"}</Typography.Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card
            title="Booking pipeline (rollup)"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Total booking rows: {bookingStats.state.value?.total ?? "—"}
                {(bookingStats.state.value?.unknown_status_count ?? 0) > 0
                  ? ` · Unknown status: ${bookingStats.state.value?.unknown_status_count}`
                  : null}
              </Typography.Text>
            }
          >
            <Typography.Paragraph type="secondary" style={{ marginTop: 0, fontSize: 12 }}>
              Rollup merges legacy statuses: queued → awaiting review with pending; booked → confirmed with approved.
            </Typography.Paragraph>
            <div style={{ height: 260 }}>
              {bookingPieData.length === 0 ? (
                <Flex align="center" justify="center" style={{ height: "100%" }}>
                  <Typography.Text type="secondary">No bookings in this university yet.</Typography.Text>
                </Flex>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(value) => [value ?? 0, "Bookings"]} />
                    <Legend />
                    <Pie data={bookingPieData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {bookingPieData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 0 }}>
        <Col span={24}>
          <Card title="Bookings by stored status">
            <Table
              size="small"
              pagination={false}
              rowKey="rawKey"
              dataSource={bookingStatusRows}
              columns={[
                { title: "Status", dataIndex: "status", key: "status" },
                {
                  title: "Count",
                  dataIndex: "count",
                  key: "count",
                  align: "right",
                  width: 100,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Top professors (slots created)">
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProfessorData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="slots_created" fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Top classrooms (reservations)">
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClassroomData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="reservations" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

