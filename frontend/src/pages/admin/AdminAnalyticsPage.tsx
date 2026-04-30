import { Card, Col, Flex, Row, Select, Space, Typography } from "antd";
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

import { getBookingStats, getTopClassrooms, getTopProfessors, getTotals } from "../../features/admin/api/adminApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { Page } from "../../shared/ui/Page";

const COLORS = ["#1677ff", "#36cfc9", "#9254de", "#ff7a45", "#ffc53d"];

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
    const b = bookingStats.state.value;
    if (!b) return [];
    return [
      { name: "Booked", value: b.booked },
      { name: "Queued", value: b.queued },
    ];
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
          <Card title="Booking status (Booked vs Queued)">
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie data={bookingPieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {bookingPieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 0 }}>
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

