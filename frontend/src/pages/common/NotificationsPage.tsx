import { Button, Card, Flex, List, Space, Tag, Typography } from "antd";
import { useEffect } from "react";

import { useNotificationsStore } from "../../features/notifications/store/useNotificationsStore";
import { Page } from "../../shared/ui/Page";
import { formatDateTime } from "../../shared/utils/dateDisplay";
import { debugError, debugLog } from "../../shared/utils/debug";
import { formatNotificationMessage } from "../../shared/utils/notificationText";

export function NotificationsPage() {
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const loading = useNotificationsStore((s) => s.loading);
  const fetch = useNotificationsStore((s) => s.fetch);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const markRead = useNotificationsStore((s) => s.markRead);

  useEffect(() => {
    (async () => {
      try {
        debugLog("[ui] notifications page open");
        await fetch();
        debugLog("[api] notifications fetched", { count: useNotificationsStore.getState().items.length });
        await markAllRead();
        debugLog("[api] notifications marked all read");
        await fetch();
        debugLog("[api] notifications re-fetched", { unread: useNotificationsStore.getState().unreadCount });
      } catch (e) {
        debugError("[ui] notifications lifecycle failed", e);
      }
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
          <Tag color={unreadCount > 0 ? "blue" : "default"}>Unread: {unreadCount}</Tag>
          <Button loading={loading} onClick={() => fetch()}>
            Refresh
          </Button>
        </Space>
      </Flex>

      <Card>
        <List
          dataSource={items}
          loading={loading}
          locale={{ emptyText: "No notifications yet." }}
          renderItem={(n) => (
            <List.Item
              actions={[n.is_read ? <Tag>Read</Tag> : <Tag color="blue">New</Tag>]}
              onClick={async () => {
                if (!n.is_read) await markRead(n.id);
              }}
              style={{ cursor: n.is_read ? "default" : "pointer" }}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Typography.Text strong={!n.is_read}>{formatNotificationMessage(n.message)}</Typography.Text>
                  </Space>
                }
                description={formatDateTime(n.created_at)}
              />
            </List.Item>
          )}
        />
      </Card>
    </Page>
  );
}

