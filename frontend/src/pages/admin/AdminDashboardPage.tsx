import { Card, Col, Divider, Row, Statistic, Typography } from "antd";
import { useEffect } from "react";

import { getBookingStats, getTotals, getTopClassrooms, getTopProfessors } from "../../features/admin/api/adminApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { Page } from "../../shared/ui/Page";

export function AdminDashboardPage() {
  const totals = useAsync(getTotals);
  const bookingStats = useAsync(getBookingStats);
  const topProfessors = useAsync(getTopProfessors);
  const topClassrooms = useAsync(getTopClassrooms);

  useEffect(() => {
    totals.run();
    bookingStats.run();
    topProfessors.run();
    topClassrooms.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page>
      <Typography.Title level={2} style={{ marginTop: 8 }}>
        Admin dashboard
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Users" value={totals.state.value?.total_users ?? "—"} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Slots" value={totals.state.value?.total_slots ?? "—"} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Bookings" value={totals.state.value?.total_bookings ?? "—"} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Reservations" value={totals.state.value?.total_reservations ?? "—"} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card title="Booking pipeline">
            {bookingStats.state.value?.rollup ? (
              <>
                <Statistic title="Awaiting review" value={bookingStats.state.value.rollup.awaiting_review} />
                <Divider style={{ margin: "12px 0" }} />
                <Statistic title="Confirmed" value={bookingStats.state.value.rollup.confirmed} />
                <Divider style={{ margin: "12px 0" }} />
                <Statistic title="Rejected" value={bookingStats.state.value.rollup.rejected} />
                <Divider style={{ margin: "12px 0" }} />
                <Statistic title="Cancelled" value={bookingStats.state.value.rollup.cancelled} />
              </>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Top professors (slots created)">
            {(topProfessors.state.value ?? []).slice(0, 5).map((p) => (
              <div key={p.professor_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <Typography.Text>{p.professor_name?.trim() || `Professor #${p.professor_id}`}</Typography.Text>
                <Typography.Text strong>{p.slots_created}</Typography.Text>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Top classrooms (reservations)">
            {(topClassrooms.state.value ?? []).slice(0, 5).map((c) => (
              <div key={c.classroom_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <Typography.Text>{c.classroom_name?.trim() || `Classroom #${c.classroom_id}`}</Typography.Text>
                <Typography.Text strong>{c.reservations}</Typography.Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

