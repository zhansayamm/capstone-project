import { Button, Card, Flex, Input, Select, Space, Switch, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { listAllBookings } from "../../features/bookings/api/bookingApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { formatRange } from "../../shared/utils/dateDisplay";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Booking } from "../../shared/types/domain";

export function AdminBookingsPage() {
  const bookings = useAsync(listAllBookings);
  const [upcoming, setUpcoming] = useState(false);
  const [status, setStatus] = useState<"booked" | "queued" | "all">("all");
  const [professorId, setProfessorId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    bookings.run({ limit: 100, upcoming });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming]);

  const filtered = useMemo(() => {
    const items = bookings.state.value ?? [];
    return items.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (professorId !== null && b.slot.professor_id !== professorId) return false;
      if (studentId !== null && b.student_id !== studentId) return false;
      if (q.trim()) {
        const query = q.trim().toLowerCase();
        const student = formatUserName(b.student, { id: b.student_id }).toLowerCase();
        const professor = formatUserName(b.slot.professor, { id: b.slot.professor_id }).toLowerCase();
        if (!student.includes(query) && !professor.includes(query)) return false;
      }
      return true;
    });
  }, [bookings.state.value, professorId, q, status, studentId]);

  const professorOptions = useMemo(() => {
    const items = bookings.state.value ?? [];
    const ids = Array.from(new Set(items.map((b) => b.slot.professor_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((b) => b.slot.professor_id === id) ?? null;
      return { value: id, label: formatUserName(sample?.slot.professor, { id }) };
    });
  }, [bookings.state.value]);

  const studentOptions = useMemo(() => {
    const items = bookings.state.value ?? [];
    const ids = Array.from(new Set(items.map((b) => b.student_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((b) => b.student_id === id) ?? null;
      return { value: id, label: formatUserName(sample?.student, { id }) };
    });
  }, [bookings.state.value]);

  const columns: ColumnsType<Booking> = [
    {
      title: "Student",
      key: "student",
      render: (_, b) => formatUserName(b.student, { id: b.student_id }),
      sorter: (a, b) =>
        formatUserName(a.student, { id: a.student_id }).localeCompare(formatUserName(b.student, { id: b.student_id })),
    },
    {
      title: "Professor",
      key: "professor",
      render: (_, b) => formatUserName(b.slot.professor, { id: b.slot.professor_id }),
      sorter: (a, b) =>
        formatUserName(a.slot.professor, { id: a.slot.professor_id }).localeCompare(
          formatUserName(b.slot.professor, { id: b.slot.professor_id }),
        ),
    },
    {
      title: "When",
      key: "when",
      sorter: (a, b) => (a.slot.start_time < b.slot.start_time ? -1 : 1),
      defaultSortOrder: "descend",
      render: (_, b) => formatRange(b.slot.start_time, b.slot.end_time),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s) => (s === "booked" ? <Tag color="green">Booked</Tag> : <Tag color="blue">Queued</Tag>),
    },
  ];

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Bookings
        </Typography.Title>
        <Space>
          <Space>
            <Typography.Text type="secondary">Upcoming</Typography.Text>
            <Switch checked={upcoming} onChange={setUpcoming} />
          </Space>
          <Select
            allowClear
            value={status}
            style={{ width: 140 }}
            options={[
              { label: "All statuses", value: "all" },
              { label: "Booked", value: "booked" },
              { label: "Queued", value: "queued" },
            ]}
            onChange={(v) => setStatus((v as typeof status) ?? "all")}
          />
          <Select
            allowClear
            showSearch
            placeholder="Professor"
            style={{ minWidth: 200 }}
            value={professorId ?? undefined}
            options={professorOptions}
            optionFilterProp="label"
            onChange={(v) => setProfessorId(typeof v === "number" ? v : null)}
          />
          <Select
            allowClear
            showSearch
            placeholder="Student"
            style={{ minWidth: 200 }}
            value={studentId ?? undefined}
            options={studentOptions}
            optionFilterProp="label"
            onChange={(v) => setStudentId(typeof v === "number" ? v : null)}
          />
          <Input.Search
            placeholder="Search student/professor"
            allowClear
            style={{ width: 240 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button loading={bookings.state.loading} onClick={() => bookings.run({ limit: 100, upcoming })}>
            Refresh
          </Button>
        </Space>
      </Flex>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={bookings.state.loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: "No bookings match your filters." }}
        />
      </Card>
    </Page>
  );
}

