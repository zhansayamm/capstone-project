/** TODO: possibly unused file — not imported by `appRouter.tsx` (students use `/student/notifications` → `NotificationsPage`); verify before deletion. */

import { Button, Card, Flex, List, Space, Tag, Typography } from "antd";
import { useEffect } from "react";

import { listMyNotifications, markAllNotificationsRead } from "../../features/notifications/api/notificationApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { dayjsToAppTz } from "../../shared/utils/dayjs";
import { formatNotificationMessage } from "../../shared/utils/notificationText";
import { Page } from "../../shared/ui/Page";

export function StudentNotificationsPage() {
  const notifications = useAsync(listMyNotifications);
  const markAllRead = useAsync(markAllNotificationsRead);

  useEffect(() => {
    (async () => {
      await notifications.run();
      await markAllRead.run();
      await notifications.run();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Notifications
        </Typography.Title>
        <Space>
          <Button loading={notifications.state.loading} onClick={() => notifications.run()}>
            Refresh
          </Button>
        </Space>
      </Flex>
      <Card>
        <List
          dataSource={notifications.state.value ?? []}
          loading={notifications.state.loading}
          locale={{ emptyText: "No notifications yet." }}
          renderItem={(n) => (
            <List.Item
              actions={[n.is_read ? <Tag color="default">Read</Tag> : <Tag color="blue">New</Tag>]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Typography.Text strong>{formatNotificationMessage(n.message)}</Typography.Text>
                  </Space>
                }
                description={dayjsToAppTz(n.created_at).fromNow()}
              />
            </List.Item>
          )}
        />
      </Card>
    </Page>
  );
}

