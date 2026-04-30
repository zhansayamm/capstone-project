import { Button, Card, Col, Row, Space, Statistic, Typography } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";

import { listMySlots } from "../../features/slots/api/slotApi";
import { listProfessorBookings } from "../../features/bookings/api/bookingApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { Page } from "../../shared/ui/Page";

export function ProfessorDashboardPage() {
  const navigate = useNavigate();
  const slots = useAsync(listMySlots);
  const bookings = useAsync(listProfessorBookings);

  useEffect(() => {
    slots.run();
    bookings.run({ limit: 100, upcoming: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queuedCount = useMemo(
    () => (bookings.state.value ?? []).filter((b) => b.status === "queued").length,
    [bookings.state.value],
  );

  return (
    <Page>
      <Typography.Title level={2} style={{ marginTop: 8 }}>
        Professor dashboard
      </Typography.Title>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => navigate("/professor/slots")}>
          Create / manage slots
        </Button>
        <Button>
          <Link to="/professor/bookings">View bookings</Link>
        </Button>
      </Space>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="My slots" value={slots.state.value?.length ?? "—"} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Upcoming bookings" value={bookings.state.value?.length ?? "—"} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Students queued" value={bookings.state.value ? queuedCount : "—"} />
          </Card>
        </Col>
      </Row>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
        Manage your office-hour availability and track bookings from students.
      </Typography.Paragraph>
    </Page>
  );
}

