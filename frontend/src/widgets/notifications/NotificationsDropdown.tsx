import { BellOutlined, CheckOutlined } from "@ant-design/icons";
import { Badge, Button, Dropdown, List, Skeleton, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useNotificationsStore } from "../../features/notifications/store/useNotificationsStore";
import { dayjs } from "../../shared/utils/dayjs";

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const loading = useNotificationsStore((s) => s.loading);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  const top = useMemo(() => items.slice(0, 6), [items]);

  const overlay = (
    <div style={{ width: 360, maxWidth: "85vw", padding: 8 }}>
      <Space style={{ width: "100%", justifyContent: "space-between", padding: "0 8px 8px" }}>
        <Typography.Text strong>Notifications</Typography.Text>
        <Space size={6}>
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            disabled={loading || unreadCount === 0}
            onClick={async () => {
              await markAllRead();
            }}
          >
            Mark all read
          </Button>
          <Button type="link" onClick={() => navigate("/notifications")}>
            View all
          </Button>
        </Space>
      </Space>
      <List
        dataSource={top}
        locale={{ emptyText: "No notifications yet." }}
        loading={loading}
        renderItem={(n) => (
          <List.Item
            style={{ paddingLeft: 8, paddingRight: 8 }}
            actions={[n.is_read ? <Tag>Read</Tag> : <Tag color="blue">New</Tag>]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Button
                    type="text"
                    style={{ padding: 0, height: "auto", textAlign: "left" }}
                    onClick={async () => {
                      if (!n.is_read) await markRead(n.id);
                      navigate("/notifications");
                    }}
                  >
                    <Typography.Text strong={!n.is_read} ellipsis style={{ maxWidth: 240, display: "inline-block" }}>
                      {n.message}
                    </Typography.Text>
                  </Button>
                </Space>
              }
              description={dayjs(n.created_at).fromNow()}
            />
          </List.Item>
        )}
      />
      <div style={{ padding: "6px 8px 0" }}>
        {loading ? (
          <Skeleton active paragraph={false} title={{ width: 120 }} />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Unread: {unreadCount} · Polling every 30s
          </Typography.Text>
        )}
      </div>
    </div>
  );

  const menu: MenuProps = {
    items: [
      {
        key: "content",
        label: overlay,
      },
    ],
  };

  return (
    <Dropdown menu={menu} trigger={["click"]} placement="bottomRight" arrow>
      <Button type="text" aria-label="Notifications">
        <Badge count={unreadCount} size="small" overflowCount={99}>
          <BellOutlined style={{ fontSize: 18 }} />
        </Badge>
      </Button>
    </Dropdown>
  );
}

