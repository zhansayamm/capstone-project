import { Button, Card, Flex, Input, Modal, Select, Space, Switch, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { cancelReservation, listAllReservations } from "../../features/reservations/api/reservationApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { dayjs, dayjsToAppTz } from "../../shared/utils/dayjs";
import { formatRange } from "../../shared/utils/dateDisplay";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Reservation } from "../../shared/types/domain";

export function AdminReservationsPage() {
  const reservations = useAsync(listAllReservations);
  const cancel = useAsync(cancelReservation);
  const [upcoming, setUpcoming] = useState(false);
  const [classroomId, setClassroomId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  useEffect(() => {
    reservations.run({ limit: 100, upcoming, classroom_id: classroomId ?? undefined, user_id: userId ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId, upcoming, userId]);

  const filtered = useMemo(() => {
    const items = reservations.state.value ?? [];
    return items.filter((r) => {
      if (classroomId !== null && r.classroom_id !== classroomId) return false;
      if (userId !== null && r.user_id !== userId) return false;
      if (q.trim()) {
        const query = q.trim().toLowerCase();
        const user = formatUserName(r.user, { id: r.user_id }).toLowerCase();
        const classroom = (r.classroom_name ?? "").toLowerCase();
        if (!user.includes(query) && !classroom.includes(query)) return false;
      }
      return true;
    });
  }, [classroomId, q, reservations.state.value, userId]);

  const canCancelReservation = (r: Reservation) => dayjs(r.start_time).isAfter(dayjs());

  const classroomOptions = useMemo(() => {
    const items = reservations.state.value ?? [];
    const ids = Array.from(new Set(items.map((r) => r.classroom_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((r) => r.classroom_id === id) ?? null;
      return { value: id, label: sample?.classroom_name ?? `Classroom #${id}` };
    });
  }, [reservations.state.value]);

  const userOptions = useMemo(() => {
    const items = reservations.state.value ?? [];
    const ids = Array.from(new Set(items.map((r) => r.user_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((r) => r.user_id === id) ?? null;
      return { value: id, label: formatUserName(sample?.user, { id }) };
    });
  }, [reservations.state.value]);

  const columns: ColumnsType<Reservation> = [
    { title: "Classroom", dataIndex: "classroom_name" },
    {
      title: "User",
      key: "user",
      render: (_, r) => formatUserName(r.user, { id: r.user_id }),
      sorter: (a, b) => formatUserName(a.user, { id: a.user_id }).localeCompare(formatUserName(b.user, { id: b.user_id })),
    },
    {
      title: "When",
      key: "when",
      sorter: (a, b) => (a.start_time < b.start_time ? -1 : 1),
      render: (_, r) => formatRange(r.start_time, r.end_time),
    },
    { title: "Created", dataIndex: "created_at", render: (v) => dayjsToAppTz(v).fromNow() },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_, r) =>
        canCancelReservation(r) ? (
          <Button danger type="link" disabled={cancel.state.loading} onClick={() => setCancelTarget(r)}>
            Cancel
          </Button>
        ) : null,
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Reservations
        </Typography.Title>
        <Space>
          <Space>
            <Typography.Text type="secondary">Upcoming</Typography.Text>
            <Switch checked={upcoming} onChange={setUpcoming} />
          </Space>
          <Select
            allowClear
            showSearch
            placeholder="Classroom"
            style={{ minWidth: 220 }}
            value={classroomId ?? undefined}
            options={classroomOptions}
            optionFilterProp="label"
            onChange={(v) => setClassroomId(typeof v === "number" ? v : null)}
          />
          <Select
            allowClear
            showSearch
            placeholder="User"
            style={{ minWidth: 220 }}
            value={userId ?? undefined}
            options={userOptions}
            optionFilterProp="label"
            onChange={(v) => setUserId(typeof v === "number" ? v : null)}
          />
          <Input.Search
            placeholder="Search user/classroom"
            allowClear
            style={{ width: 240 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button
            loading={reservations.state.loading}
            onClick={() =>
              reservations.run({
                limit: 100,
                upcoming,
                classroom_id: classroomId ?? undefined,
                user_id: userId ?? undefined,
              })
            }
          >
            Refresh
          </Button>
        </Space>
      </Flex>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={reservations.state.loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: "No reservations match your filters." }}
        />
      </Card>

      <Modal
        title="Cancel reservation"
        open={!!cancelTarget}
        okText="Confirm"
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: cancel.state.loading }}
        onCancel={() => setCancelTarget(null)}
        onOk={async () => {
          if (!cancelTarget) return;
          try {
            await cancel.run(cancelTarget.id);
            message.success("Reservation cancelled");
            setCancelTarget(null);
            await reservations.run({
              limit: 100,
              upcoming,
              classroom_id: classroomId ?? undefined,
              user_id: userId ?? undefined,
            });
          } catch {
            message.error("Could not cancel reservation");
          }
        }}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Are you sure you want to cancel this reservation?
        </Typography.Paragraph>
      </Modal>
    </Page>
  );
}

