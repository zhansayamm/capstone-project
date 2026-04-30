import { Badge, Button, Card, Col, Row, Space, Statistic, Typography } from "antd";
import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";

import { listMyBookings } from "../../features/bookings/api/bookingApi";
import { listMyNotifications } from "../../features/notifications/api/notificationApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { Page } from "../../shared/ui/Page";

export function StudentDashboardPage() {
  const bookings = useAsync(listMyBookings);
  const notifications = useAsync(listMyNotifications);

  useEffect(() => {
    bookings.run({ limit: 100, upcoming: true });
    notifications.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(
    () => (notifications.state.value ?? []).filter((n) => !n.is_read).length,
    [notifications.state.value],
  );

  return (
    <Page>
      <Typography.Title level={2} style={{ marginTop: 8 }}>
        Student dashboard
      </Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title="Available Professors + Slots"
            extra={
              <Button type="link">
                <Link to="/student/slots">View</Link>
              </Button>
            }
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Browse upcoming slots and book instantly. If a slot is taken, you can join the queue.
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title="My Bookings"
            extra={
              <Button type="link">
                <Link to="/student/bookings">View</Link>
              </Button>
            }
          >
            <Space direction="vertical" size={6}>
              <Statistic title="Upcoming bookings/queues" value={bookings.state.value?.length ?? "—"} />
              <Typography.Text type="secondary">Cancel anytime; queued bookings show your position.</Typography.Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <span>Notifications</span>
                <Badge count={unreadCount} overflowCount={99} />
              </Space>
            }
            extra={
              <Button type="link">
                <Link to="/student/notifications">View</Link>
              </Button>
            }
          >
            <Statistic title="Unread" value={notifications.state.value ? unreadCount : "—"} />
          </Card>
        </Col>
      </Row>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
        Use the sidebar to view slots, manage bookings, and track reminders/updates.
      </Typography.Paragraph>
    </Page>
  );
}

