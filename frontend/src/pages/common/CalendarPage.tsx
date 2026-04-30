import { Button, Card, Flex, Space, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

import { calendarApi } from "../../shared/api";
import { downloadBlob } from "../../shared/utils/download";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import { useAuthStore } from "../../features/auth/store/useAuthStore";
import type { ProfessorWeekScheduleResponse, StudentScheduleResponse } from "../../shared/api/modules/calendarApi";

export function CalendarPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [loading, setLoading] = useState(false);
  const [studentSchedule, setStudentSchedule] = useState<StudentScheduleResponse | null>(null);
  const [professorWeek, setProfessorWeek] = useState<ProfessorWeekScheduleResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (role !== "student" && role !== "professor") return;
      setLoading(true);
      try {
        if (role === "student") {
          const data = await calendarApi.getStudentSchedule();
          if (mounted) setStudentSchedule(data);
        } else if (role === "professor") {
          const data = await calendarApi.getProfessorWeekSchedule();
          if (mounted) setProfessorWeek(data);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [role]);

  const events = useMemo(() => {
    if (role === "student" && studentSchedule) {
      const bookedEvents = (studentSchedule.booked ?? []).map((b) => ({
        id: `booking-${b.id}`,
        title: `Office hour (${formatUserName(b.slot.professor, { id: b.slot.professor_id })})`,
        start: b.slot.start_time,
        end: b.slot.end_time,
        backgroundColor: "#52c41a",
        borderColor: "#52c41a",
      }));
      const queuedEvents = (studentSchedule.queued ?? []).map((b) => ({
        id: `queue-${b.id}`,
        title: `Queued (${formatUserName(b.slot.professor, { id: b.slot.professor_id })})`,
        start: b.slot.start_time,
        end: b.slot.end_time,
        backgroundColor: "#1677ff",
        borderColor: "#1677ff",
      }));
      const reservationEvents = (studentSchedule.reservations ?? []).map((r) => ({
        id: `reservation-${r.id}`,
        title: `Classroom ${r.classroom_name}`,
        start: r.start_time,
        end: r.end_time,
        backgroundColor: "#9254de",
        borderColor: "#9254de",
      }));
      return [...bookedEvents, ...queuedEvents, ...reservationEvents].map((e) => {
        const isPast = dayjs(e.end).isBefore(dayjs());
        if (!isPast) return e;
        return {
          ...e,
          title: `${e.title} (Past)`,
          backgroundColor: "#d9d9d9",
          borderColor: "#d9d9d9",
          textColor: "#595959",
        };
      });
    }
    if (role === "professor" && professorWeek) {
      const dayKeys = Object.keys(professorWeek) as Array<keyof ProfessorWeekScheduleResponse>;
      const flat = dayKeys.flatMap((k) => professorWeek[k] ?? []);
      return flat.map((s) => {
        const isPast = dayjs(s.end_time).isBefore(dayjs());
        const base = {
          id: `slot-${s.id}`,
          title: s.is_booked ? "Booked slot" : "Available slot",
          start: s.start_time,
          end: s.end_time,
          backgroundColor: s.is_booked ? "#fa8c16" : "#52c41a",
          borderColor: s.is_booked ? "#fa8c16" : "#52c41a",
        };
        if (!isPast) return base;
        return {
          ...base,
          title: `${base.title} (Past)`,
          backgroundColor: "#d9d9d9",
          borderColor: "#d9d9d9",
          textColor: "#595959",
        };
      });
    }
    return [];
  }, [professorWeek, role, studentSchedule]);

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Calendar
        </Typography.Title>
        <Space>
          <Button
            type="primary"
            onClick={async () => {
              const blob = await calendarApi.downloadMyCalendarIcs();
              downloadBlob(blob, `booking-time-${dayjs().format("YYYY-MM-DD")}.ics`);
            }}
          >
            Download Calendar (.ics)
          </Button>
        </Space>
      </Flex>

      {role === "student" || role === "professor" ? (
        <Card>
          <Space style={{ marginBottom: 12 }}>
            {role === "student" ? (
              <>
                <Tag color="green">Booked</Tag>
                <Tag color="blue">Queued</Tag>
                <Tag color="purple">Reservation</Tag>
              </>
            ) : (
              <>
                <Tag color="green">Available</Tag>
                <Tag color="orange">Booked</Tag>
              </>
            )}
          </Space>
          <div style={{ minHeight: 620 }}>
            <FullCalendar
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "timeGridWeek,dayGridMonth",
              }}
              events={events}
              eventClassNames={(arg) => {
                const end = arg.event.end ? dayjs(arg.event.end) : dayjs(arg.event.start);
                return end.isBefore(dayjs()) ? ["app-event-past"] : [];
              }}
              height="auto"
              nowIndicator
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              weekends
              editable={false}
              selectable={false}
              eventDisplay="block"
              loading={(isLoading) => {
                // FullCalendar internal loading; we also have our own fetch state.
                void isLoading;
              }}
            />
          </div>
          {loading && (
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              Loading schedule…
            </Typography.Paragraph>
          )}
        </Card>
      ) : (
        <Card>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Calendar weekly view is available for students and professors. You can still download your `.ics` file here.
          </Typography.Paragraph>
        </Card>
      )}
    </Page>
  );
}

