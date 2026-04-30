import { Button, Card, DatePicker, Flex, message, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";

import { createBooking } from "../../features/bookings/api/bookingApi";
import { listSlots } from "../../features/slots/api/slotApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatDateTime } from "../../shared/utils/dateDisplay";
import { disabledTimeForBusinessHours } from "../../shared/utils/businessHours";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Slot } from "../../shared/types/domain";

export function StudentSlotsPage() {
  const slotsQuery = useAsync(listSlots);
  const book = useAsync(createBooking);

  const [availableOnly, setAvailableOnly] = useState(true);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [professorId, setProfessorId] = useState<number | null>(null);
  const [queueBySlotId, setQueueBySlotId] = useState<Record<number, number>>({});

  useEffect(() => {
    slotsQuery.run({ limit: 50, available: availableOnly });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableOnly]);

  const filtered = useMemo(() => {
    const items = slotsQuery.state.value ?? [];
    const byProfessor = professorId ? items.filter((s) => s.professor_id === professorId) : items;
    if (!range) return byProfessor;
    const [from, to] = range;
    const fromMs = from ? from.valueOf() : null;
    const toMs = to ? to.valueOf() : null;
    return byProfessor.filter((s) => {
      const st = dayjs(s.start_time).valueOf();
      if (fromMs !== null && st < fromMs) return false;
      if (toMs !== null && st > toMs) return false;
      return true;
    });
  }, [professorId, range, slotsQuery.state.value]);

  const professorOptions = useMemo(() => {
    const items = slotsQuery.state.value ?? [];
    const ids = Array.from(new Set(items.map((s) => s.professor_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((s) => s.professor_id === id) ?? null;
      return { label: formatUserName(sample?.professor, { id }), value: id };
    });
  }, [slotsQuery.state.value]);

  const columns: ColumnsType<Slot> = [
    {
      title: "Start",
      dataIndex: "start_time",
      render: (v) => formatDateTime(v),
    },
    {
      title: "End",
      dataIndex: "end_time",
      render: (v) => formatDateTime(v),
    },
    {
      title: "Status",
      dataIndex: "is_booked",
      render: (isBooked, row) => (
        <Space>
          {isBooked ? <Tag color="orange">Booked</Tag> : <Tag color="green">Available</Tag>}
          {dayjs(row.end_time).isBefore(dayjs()) ? <Tag>Past</Tag> : null}
          {queueBySlotId[row.id] ? <Tag color="blue">Queue #{queueBySlotId[row.id]}</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Professor",
      key: "professor",
      render: (_, row) => formatUserName(row.professor, { id: row.professor_id }),
      sorter: (a, b) =>
        formatUserName(a.professor, { id: a.professor_id }).localeCompare(formatUserName(b.professor, { id: b.professor_id })),
    },
    {
      title: "",
      key: "actions",
      width: 160,
      render: (_, row) => (
        (() => {
          const isPast = dayjs(row.end_time).isBefore(dayjs());
          return (
        <Button
          type="primary"
          disabled={book.state.loading || isPast}
          onClick={async () => {
            const booking = await book.run(row.id);
            if (booking.status === "queued" && booking.queue_position) {
              setQueueBySlotId((m) => ({ ...m, [row.id]: booking.queue_position ?? 0 }));
              message.info(`Joined queue (position #${booking.queue_position})`);
            } else if (booking.status === "queued") {
              message.info("Joined queue");
            } else {
              message.success("Booked successfully");
            }
            await slotsQuery.run({ limit: 50, available: availableOnly });
          }}
        >
          {isPast ? "Past" : row.is_booked ? "Join queue" : "Book"}
        </Button>
          );
        })()
      ),
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Available slots
        </Typography.Title>
        <Space>
          <Select
            allowClear
            placeholder="Filter professor"
            style={{ minWidth: 180 }}
            options={professorOptions}
            value={professorId ?? undefined}
            onChange={(v) => setProfessorId(v ?? null)}
          />
          <DatePicker.RangePicker
            showTime
            allowEmpty={[true, true]}
            value={range as [Dayjs | null, Dayjs | null] | null}
            onChange={(v) => setRange((v as [Dayjs | null, Dayjs | null] | null) ?? null)}
            disabledTime={disabledTimeForBusinessHours}
            disabledDate={(current) => {
              if (!current) return false;
              return current.endOf("day").isBefore(dayjs().startOf("day"));
            }}
          />
          <Button onClick={() => setAvailableOnly((v) => !v)}>
            {availableOnly ? "Show all" : "Available only"}
          </Button>
          <Button loading={slotsQuery.state.loading} onClick={() => slotsQuery.run({ limit: 50, available: availableOnly })}>
            Refresh
          </Button>
        </Space>
      </Flex>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={slotsQuery.state.loading}
          rowClassName={(row) => (dayjs(row.end_time).isBefore(dayjs()) ? "app-row-past" : "")}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: "No slots found. Try changing filters or refresh.",
          }}
        />
      </Card>
    </Page>
  );
}

