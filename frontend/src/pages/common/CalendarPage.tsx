import { Button, Calendar, Card, Checkbox, Divider, Flex, Modal, Space, Spin, Tag, Tooltip, Typography, theme } from "antd";
import type { CalendarProps } from "antd";
import type { Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { calendarApi } from "../../shared/api";
import type {
  CalendarDayBookingRow,
  CalendarDayGroup,
  DayDetailsResponse,
  DayPreviewItem,
  DaySummary,
  MonthSummaryResponse,
  StudentReservationDetail,
  WeekSummaryResponse,
} from "../../shared/api/modules/calendarApi";
import { CalendarWeekGrid } from "./CalendarWeekGrid";
import { downloadBlob } from "../../shared/utils/download";
import { dayjs, mondayContaining } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import { useAuthStore } from "../../features/auth/store/useAuthStore";

const BOOKING_PREVIEW = "#1677ff";
const BOOKING_TEXT_DARK = "#0958d9";
const RES_PREVIEW = "#722ed1";
const SLOT_PREVIEW = "#52c41a";

const STUDENT_MAX_CELL_ITEMS = 2;
/** Professor + admin month cells: grouped slot rows (backend caps list). */
const GROUPED_MONTH_MAX_GROUPS = 2;

function professorUsageAccent(usage_band: string | undefined | null): string {
  if (usage_band === "green") return "#52c41a";
  if (usage_band === "red") return "#ff4d4f";
  return "#faad14";
}

function previewBadge(kind: string): { label: string; color: string } {
  if (kind === "booking") return { label: "[Booking]", color: BOOKING_PREVIEW };
  if (kind === "reservation") return { label: "[Reservation]", color: RES_PREVIEW };
  if (kind === "slot") return { label: "[Available]", color: SLOT_PREVIEW };
  return { label: "", color: "inherit" };
}

function studentPillColors(kind: string): { backgroundColor: string; color: string } {
  if (kind === "booking") return { backgroundColor: "rgba(22, 119, 255, 0.12)", color: BOOKING_TEXT_DARK };
  if (kind === "reservation") return { backgroundColor: "rgba(114, 46, 209, 0.12)", color: RES_PREVIEW };
  if (kind === "slot") return { backgroundColor: "rgba(82, 196, 26, 0.14)", color: SLOT_PREVIEW };
  return { backgroundColor: "rgba(0,0,0,0.06)", color: tokenFallbackText() };
}

function tokenFallbackText(): string {
  return "rgba(0,0,0,0.75)";
}

function StudentEventChip({ p }: { p: DayPreviewItem }) {
  const { label } = previewBadge(p.kind);
  const line = label ? `${label} ${p.title}`.trim() : p.title;
  const colors = studentPillColors(p.kind);
  return (
    <div
      title={line}
      style={{
        fontSize: 12,
        padding: "2px 6px",
        borderRadius: 6,
        marginBottom: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        ...colors,
        lineHeight: 1.35,
        flexShrink: 0,
      }}
    >
      {line}
    </div>
  );
}

function FacultyPreviewLine({ p }: { p: DayPreviewItem }) {
  const { label, color } = previewBadge(p.kind);
  const line = `${label ? `${label} ` : ""}${p.title}`;
  return (
    <Typography.Text ellipsis style={{ fontSize: 11, display: "block", color: label ? color : undefined, lineHeight: 1.35 }}>
      {line}
    </Typography.Text>
  );
}

function ProfessorGroupChip({ p, borderSecondary }: { p: DayPreviewItem; borderSecondary: string }) {
  const accent = professorUsageAccent(p.usage_band);
  const range = `${p.time}–${p.time_end ?? p.time}`;
  const ratio =
    p.booked !== undefined && p.booked !== null && p.capacity !== undefined && p.capacity !== null
      ? `${p.booked} / ${p.capacity} booked`
      : null;
  return (
    <div
      title={`${p.title}\n${range}${ratio ? `\n${ratio}` : ""}`}
      style={{
        borderLeft: `3px solid ${accent}`,
        background: "#fff",
        borderTop: `1px solid ${borderSecondary}`,
        borderRight: `1px solid ${borderSecondary}`,
        borderBottom: `1px solid ${borderSecondary}`,
        fontSize: 12,
        padding: "4px 6px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        flexShrink: 0,
      }}
    >
      <Typography.Text ellipsis style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 1, color: "rgba(0,0,0,0.88)" }}>
        {p.title}
      </Typography.Text>
      <Typography.Text type="secondary" ellipsis style={{ display: "block", fontSize: 11, marginBottom: 0, whiteSpace: "nowrap" }}>
        {range}
      </Typography.Text>
      {ratio ? (
        <Typography.Text type="secondary" ellipsis style={{ display: "block", fontSize: 11 }}>
          {ratio}
        </Typography.Text>
      ) : null}
    </div>
  );
}

function statusTag(status: string) {
  const s = status.toLowerCase();
  if (s === "approved" || s === "booked") return <Tag color="green">Approved</Tag>;
  if (s === "pending" || s === "queued") return <Tag color="gold">Pending</Tag>;
  if (s === "rejected") return <Tag color="red">Rejected</Tag>;
  if (s === "cancelled") return <Tag>Cancelled</Tag>;
  if (s === "available") return <Tag color="green">Available</Tag>;
  if (s === "reservation") return <Tag color="purple">Reservation</Tag>;
  return <Tag>{status}</Tag>;
}

function dayTooltipPreviewLine(p: DayPreviewItem): string {
  if (p.kind === "prof_slot_group" || (p.capacity != null && p.booked != null)) {
    const range = `${p.time}–${p.time_end ?? p.time}`;
    return `${p.title}\n${range}\n${p.booked}/${p.capacity} booked`;
  }
  const { label } = previewBadge(p.kind);
  const prefix = label ? `${label} ` : "";
  return `${prefix}${p.title}`;
}

function dayTooltipSummary(day?: DaySummary) {
  if (!day?.preview?.length && !day?.more_count) return undefined;
  const lines = (day.preview ?? []).map((p) => dayTooltipPreviewLine(p));
  if (day.more_count > 0) lines.push(`+${day.more_count} more`);
  return lines.join("\n\n");
}

export function CalendarPage() {
  const { token } = theme.useToken();
  const role = useAuthStore((s) => s.user?.role);
  const allowed = role === "student" || role === "professor" || role === "admin";
  const isStudent = role === "student";
  const isProfessor = role === "professor";

  const [view, setView] = useState<"month" | "week">("month");
  const [monthCursor, setMonthCursor] = useState(() => dayjs());
  const [summary, setSummary] = useState<MonthSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [weekMonday, setWeekMonday] = useState(() => mondayContaining(dayjs()));
  const [weekSummary, setWeekSummary] = useState<WeekSummaryResponse | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);

  const [stuIncludeBookings, setStuIncludeBookings] = useState(true);
  const [stuIncludeAvailableSlots, setStuIncludeAvailableSlots] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [pickedDateStr, setPickedDateStr] = useState<string | null>(null);
  const [details, setDetails] = useState<DayDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadMonth = useCallback(
    async (year: number, month1to12: number) => {
      if (!allowed) return;
      setSummaryLoading(true);
      try {
        const data =
          role === "student"
            ? await calendarApi.getMonthSummary({
                year,
                month: month1to12,
                include_bookings: stuIncludeBookings,
                include_available_slots: stuIncludeAvailableSlots,
              })
            : await calendarApi.getMonthSummary({ year, month: month1to12 });
        setSummary(data);
      } finally {
        setSummaryLoading(false);
      }
    },
    [allowed, role, stuIncludeBookings, stuIncludeAvailableSlots],
  );

  const loadDay = useCallback(
    async (dateIso: string) => {
      if (!allowed) return;
      setDetailsLoading(true);
      try {
        const data =
          role === "student"
            ? await calendarApi.getDayDetails(dateIso, {
                include_bookings: stuIncludeBookings,
                include_available_slots: stuIncludeAvailableSlots,
              })
            : await calendarApi.getDayDetails(dateIso);
        setDetails(data);
      } finally {
        setDetailsLoading(false);
      }
    },
    [allowed, role, stuIncludeBookings, stuIncludeAvailableSlots],
  );

  const loadWeek = useCallback(async () => {
    if (!allowed) return;
    setWeekLoading(true);
    try {
      const ws = weekMonday.format("YYYY-MM-DD");
      const data =
        role === "student"
          ? await calendarApi.getWeekSummary({
              week_start: ws,
              include_bookings: stuIncludeBookings,
              include_available_slots: stuIncludeAvailableSlots,
            })
          : await calendarApi.getWeekSummary({ week_start: ws });
      setWeekSummary(data);
    } finally {
      setWeekLoading(false);
    }
  }, [allowed, weekMonday, role, stuIncludeBookings, stuIncludeAvailableSlots]);

  useEffect(() => {
    if (view !== "month") return;
    const tick = requestAnimationFrame(() => {
      void loadMonth(monthCursor.year(), monthCursor.month() + 1);
    });
    return () => cancelAnimationFrame(tick);
  }, [view, loadMonth, monthCursor]);

  useEffect(() => {
    if (view !== "week" || !allowed) return;
    const tick = requestAnimationFrame(() => {
      void loadWeek();
    });
    return () => cancelAnimationFrame(tick);
  }, [view, allowed, loadWeek]);

  useEffect(() => {
    if (!modalOpen || !pickedDateStr) return;
    const tick = requestAnimationFrame(() => {
      void loadDay(pickedDateStr);
    });
    return () => cancelAnimationFrame(tick);
  }, [modalOpen, pickedDateStr, loadDay, stuIncludeBookings, stuIncludeAvailableSlots]);

  const onPanelChange: CalendarProps<Dayjs>["onPanelChange"] = (value, mode) => {
    setMonthCursor(value);
    if (mode === "month" && view === "month") loadMonth(value.year(), value.month() + 1);
  };

  const openDayModal = useCallback((dateIso: string) => {
    if (!allowed) return;
    setPickedDateStr(dateIso);
    setModalOpen(true);
    setDetails(null);
  }, [allowed]);

  const onSelect: CalendarProps<Dayjs>["onSelect"] = (value) => {
    if (!value) return;
    openDayModal(dayjs(value).format("YYYY-MM-DD"));
  };

  const weekViewerRole =
    role === "admin" ? "admin" : role === "professor" ? ("professor" as const) : ("student" as const);

  const fullCellRender: CalendarProps<Dayjs>["fullCellRender"] = (d, info) => {
    if (info.type !== "date") return info.originNode;
    const key = dayjs(d).format("YYYY-MM-DD");
    const cell = summary?.days[key];
    const tip = dayTooltipSummary(cell);

    let inner: ReactNode;

    if (isStudent) {
      const previews = cell?.preview ?? [];
      const shown = previews.slice(0, STUDENT_MAX_CELL_ITEMS);
      const hiddenInBundledPreview = Math.max(0, previews.length - STUDENT_MAX_CELL_ITEMS);
      const plusMoreCount = hiddenInBundledPreview + (cell?.more_count ?? 0);

      inner = (
        <div
          className="app-cal-day-cell app-cal-day-cell--student"
          style={{
            padding: "4px 4px",
            borderRadius: 6,
            background: "#fff",
            border: `1px solid ${token.colorBorderSecondary}`,
            boxSizing: "border-box",
          }}
        >
          <Typography.Text strong style={{ fontSize: 12, display: "block", lineHeight: "16px", marginBottom: 2 }}>
            {dayjs(d).date()}
          </Typography.Text>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: 80,
              overflow: "hidden",
            }}
          >
            {shown.map((p, idx) => (
              <StudentEventChip key={`${p.kind}-${p.time}-${idx}`} p={p} />
            ))}
            {plusMoreCount > 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: "14px", flexShrink: 0 }}>
                +{plusMoreCount} more
              </Typography.Text>
            ) : null}
          </div>
        </div>
      );
    } else {
      /* Professor / admin: same grouped slot month UI; admin data is university-wide. */
      const previews = cell?.preview ?? [];
      const shown = previews.slice(0, GROUPED_MONTH_MAX_GROUPS);
      const hiddenBundled = Math.max(0, previews.length - GROUPED_MONTH_MAX_GROUPS);
      const plusMoreCount = hiddenBundled + (cell?.more_count ?? 0);

      inner = (
        <div
          className={`app-cal-day-cell app-cal-day-cell--grouped-slots app-cal-day-cell--${isProfessor ? "professor" : "admin"}`}
          style={{
            padding: "4px 4px",
            borderRadius: 6,
            background: "#fff",
            border: `1px solid ${token.colorBorderSecondary}`,
            boxSizing: "border-box",
          }}
        >
          <Typography.Text strong style={{ fontSize: 12, display: "block", lineHeight: "16px", marginBottom: 2 }}>
            {dayjs(d).date()}
          </Typography.Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 92, overflow: "hidden" }}>
            {shown.map((p, idx) =>
              p.kind === "prof_slot_group" || p.capacity != null ? (
                <ProfessorGroupChip key={`prof-g-${p.title}-${p.time}-${idx}`} p={p} borderSecondary={token.colorBorderSecondary} />
              ) : (
                <div key={`prof-f-${p.kind}-${p.time}-${idx}`} style={{ maxHeight: 40, overflow: "hidden" }}>
                  <FacultyPreviewLine p={p} />
                </div>
              ),
            )}
            {plusMoreCount > 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: "14px", flexShrink: 0 }}>
                +{plusMoreCount} more
              </Typography.Text>
            ) : null}
          </div>
        </div>
      );
    }

    return tip ? (
      <Tooltip title={<pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{tip}</pre>}>{inner}</Tooltip>
    ) : (
      inner
    );
  };

  const legendProfessor = useMemo(
    () => (
      <Typography.Text style={{ fontSize: 12 }} type="secondary">
        <span style={{ color: "#52c41a", fontWeight: 500 }}>● Low usage</span>
        <span style={{ margin: "0 10px", color: "rgba(0,0,0,0.12)" }}>|</span>
        <span style={{ color: "#faad14", fontWeight: 500 }}>● Medium usage</span>
        <span style={{ margin: "0 10px", color: "rgba(0,0,0,0.12)" }}>|</span>
        <span style={{ color: "#ff4d4f", fontWeight: 500 }}>● Full</span>
      </Typography.Text>
    ),
    [],
  );

  const legendStudent = useMemo(
    () => (
      <Typography.Text style={{ fontSize: 12 }} type="secondary">
        <span style={{ color: BOOKING_TEXT_DARK, fontWeight: 500 }}>● Booking</span>
        <span style={{ margin: "0 10px", color: "rgba(0,0,0,0.12)" }}>|</span>
        <span style={{ color: RES_PREVIEW, fontWeight: 500 }}>● Reservation</span>
        <span style={{ margin: "0 10px", color: "rgba(0,0,0,0.12)" }}>|</span>
        <span style={{ color: SLOT_PREVIEW, fontWeight: 500 }}>● Available</span>
      </Typography.Text>
    ),
    [],
  );

  const renderStaffBookingRow = (row: CalendarDayBookingRow) => {
    const who = row.student ? formatUserName(row.student, { id: row.student.id }) : "—";
    return (
      <Flex
        key={`${row.slot_id}-${row.booking_id}-${row.time_range}`}
        align="flex-start"
        justify="space-between"
        wrap
        gap={10}
        style={{
          padding: "10px 10px",
          borderRadius: 10,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: "#fff",
        }}
      >
        <div>
          <Typography.Text strong>{who}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.time_range}
            </Typography.Text>
          </div>
          {row.description ? (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 6, fontSize: 12, fontStyle: "italic" }} ellipsis={{ rows: 2 }}>
              {row.description}
            </Typography.Paragraph>
          ) : null}
        </div>
        <Space>{statusTag(row.status)}</Space>
      </Flex>
    );
  };

  const renderStudentBookingRow = (row: CalendarDayBookingRow) => {
    const prof = row.professor ? formatUserName(row.professor, { id: row.professor.id }) : "—";
    return (
      <Flex
        key={`stu-b-${row.slot_id}-${row.booking_id}`}
        align="flex-start"
        justify="space-between"
        wrap
        gap={10}
        style={{
          padding: "10px 10px",
          borderRadius: 10,
          border: `1px solid rgba(22, 119, 255, 0.35)`,
          background: "rgba(22, 119, 255, 0.04)",
        }}
      >
        <div>
          <Tag color="blue" style={{ marginBottom: 4 }}>
            Booking
          </Tag>
          <Typography.Text strong style={{ display: "block" }}>
            Professor: {prof}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.time_range}
          </Typography.Text>
          {row.description ? (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 6, fontSize: 12, fontStyle: "italic" }} ellipsis={{ rows: 2 }}>
              {row.description}
            </Typography.Paragraph>
          ) : null}
        </div>
        <Space>{statusTag(row.status)}</Space>
      </Flex>
    );
  };

  const renderAvailableSlotRow = (row: CalendarDayBookingRow) => {
    const prof = row.professor ? formatUserName(row.professor, { id: row.professor.id }) : "—";
    return (
      <Flex
        key={`avail-${row.slot_id}-${row.time_range}`}
        align="flex-start"
        justify="space-between"
        wrap
        gap={10}
        style={{
          padding: "10px 10px",
          borderRadius: 10,
          border: `1px solid rgba(82, 196, 26, 0.45)`,
          background: "rgba(82, 196, 26, 0.06)",
        }}
      >
        <div>
          <Tag color="green" style={{ marginBottom: 4 }}>
            Available slot
          </Tag>
          <Typography.Text strong style={{ display: "block" }}>
            {prof}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.time_range}
          </Typography.Text>
        </div>
        {statusTag("available")}
      </Flex>
    );
  };

  const renderReservationDetail = (r: StudentReservationDetail, idx: number) => (
    <Flex
      key={`${r.classroom_name}-${idx}`}
      align="flex-start"
      justify="space-between"
      wrap
      gap={10}
      style={{
        padding: "10px 10px",
        borderRadius: 10,
        border: `1px solid rgba(114, 46, 209, 0.38)`,
        background: "rgba(114, 46, 209, 0.05)",
      }}
    >
      <div>
        <Tag color="purple" style={{ marginBottom: 4 }}>
          Reservation
        </Tag>
        <Typography.Text strong style={{ display: "block" }}>
          {r.classroom_name}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {r.time_range}
        </Typography.Text>
        {r.created_at ? (
          <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
            Created {dayjs(r.created_at).format("MMM D, HH:mm")}
          </Typography.Text>
        ) : null}
      </div>
    </Flex>
  );

  const groupedModalStaff = details?.groups ?? [];

  const studentModalEmpty =
    isStudent &&
    details &&
    !(stuIncludeBookings && details.student_bookings && details.student_bookings.length > 0) &&
    !(details.student_reservations && details.student_reservations.length > 0) &&
    !(stuIncludeAvailableSlots && details.student_available_slots && details.student_available_slots.length > 0);

  const renderStudentGroupedSection = (
    items: CalendarDayGroup[] | undefined,
    renderRow: (r: CalendarDayBookingRow) => ReactNode,
    countColor: string,
  ) =>
    (items ?? []).map((g) => (
      <Card key={`${g.slot_title}-${g.date}`} size="small" bodyStyle={{ padding: 14 }}>
        <Flex align="center" justify="space-between" wrap gap={12}>
          <Space align="baseline" wrap size={8}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {g.slot_title}
            </Typography.Title>
            <Tag>{dayjs(g.date).format("ddd, MMM D")}</Tag>
          </Space>
          <Tag color={countColor}>
            {g.booking_count} item{g.booking_count === 1 ? "" : "s"}
          </Tag>
        </Flex>
        {g.slot_description ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            {g.slot_description}
          </Typography.Paragraph>
        ) : null}
        <Divider style={{ margin: "12px 0" }} />
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {g.bookings.map((b, i) => (
            <span key={`${g.slot_title}-${i}`}>{renderRow(b)}</span>
          ))}
        </Space>
      </Card>
    ));

  return (
    <Page>
      <Flex
        align="center"
        justify="space-between"
        wrap
        gap={12}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Typography.Title level={2} style={{ margin: 0 }}>
          Calendar
        </Typography.Title>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="primary"
            onClick={async () => {
              const blob = await calendarApi.downloadMyCalendarIcs();
              downloadBlob(blob, `booking-time-${dayjs().format("YYYY-MM-DD")}.ics`);
            }}
          >
            Download Calendar (.ics)
          </Button>
        </div>
      </Flex>

      {!allowed ? (
        <Card>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Calendar is available for students, professors, and administrators.
          </Typography.Paragraph>
        </Card>
      ) : (
        <Card>
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {isStudent ? (
              <>
                <Typography.Text type="secondary">
                  Tap a day for the full list. By default only your bookings and reservations load; turn on Available slots to browse openings.
                </Typography.Text>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Checkbox checked={stuIncludeBookings} onChange={(e) => setStuIncludeBookings(e.target.checked)}>
                    My bookings
                  </Checkbox>
                  <Checkbox checked={stuIncludeAvailableSlots} onChange={(e) => setStuIncludeAvailableSlots(e.target.checked)}>
                    Available slots
                  </Checkbox>
                </div>
              </>
            ) : (
              <Typography.Text type="secondary">
                {isProfessor
                  ? "Days show slot groups by title (combined time range and booking fill). Click a day for every slot and student list. Week view shows individual time blocks."
                  : "University-wide office hours grouped the same way: by slot title per day with total bookings vs capacity. Click a day for all slots and students. Week view uses the professor-style busy (blue) vs open (outline) timeline."}
              </Typography.Text>
            )}
            <Flex wrap="wrap" align="center" gap={12}>
              <Space.Compact>
                <Button
                  type={view === "month" ? "primary" : "default"}
                  onClick={() => {
                    setView("month");
                    setMonthCursor(weekMonday);
                  }}
                >
                  Month
                </Button>
                <Button
                  type={view === "week" ? "primary" : "default"}
                  onClick={() => {
                    setWeekMonday(mondayContaining(monthCursor));
                    setView("week");
                  }}
                >
                  Week
                </Button>
              </Space.Compact>
            </Flex>
            {isStudent ? legendStudent : legendProfessor}
            {view === "week" && isStudent ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Week view: available openings use a green outline; bookings and reservations are solid blocks. Click a block to open that day.
              </Typography.Text>
            ) : null}
            {view === "week" && !isStudent ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Week: busy slots (blue) vs open slots (green outline). Click a block for day details.
              </Typography.Text>
            ) : null}
            <div
              style={{
                position: "relative",
                flex: view === "week" ? "1 1 auto" : undefined,
                minHeight: view === "week" ? 360 : undefined,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {view === "month" && summaryLoading ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    background: "rgba(255,255,255,0.45)",
                  }}
                >
                  <Spin />
                </div>
              ) : null}
              {view === "week" ? (
                <CalendarWeekGrid
                  weekMonday={weekMonday}
                  events={weekSummary?.events ?? []}
                  loading={weekLoading}
                  role={weekViewerRole}
                  onPrevWeek={() => setWeekMonday((w) => w.subtract(7, "day"))}
                  onNextWeek={() => setWeekMonday((w) => w.add(7, "day"))}
                  onThisWeek={() => setWeekMonday(mondayContaining(dayjs()))}
                  onOpenDay={openDayModal}
                />
              ) : (
                <Calendar
                  value={monthCursor}
                  onPanelChange={onPanelChange}
                  onSelect={onSelect}
                  fullscreen={false}
                  fullCellRender={fullCellRender}
                />
              )}
            </div>
          </Space>
        </Card>
      )}

      <Modal
        title={pickedDateStr ? `Day · ${pickedDateStr}` : "Day"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setDetails(null);
        }}
        footer={null}
        width={740}
        destroyOnClose
      >
        {detailsLoading ? (
          <Flex justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : isStudent && details ? (
          studentModalEmpty ? (
            <Typography.Text type="secondary">No bookings or slots for this day (with current filters).</Typography.Text>
          ) : (
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {stuIncludeBookings && details.student_bookings && details.student_bookings.length > 0 ? (
                <div>
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    My bookings
                  </Typography.Title>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {renderStudentGroupedSection(details.student_bookings, renderStudentBookingRow, "blue")}
                  </Space>
                </div>
              ) : null}

              {details.student_reservations && details.student_reservations.length > 0 ? (
                <div>
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    Reservations
                  </Typography.Title>
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {details.student_reservations.map(renderReservationDetail)}
                  </Space>
                </div>
              ) : null}

              {stuIncludeAvailableSlots && details.student_available_slots && details.student_available_slots.length > 0 ? (
                <div>
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    Available slots
                  </Typography.Title>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {renderStudentGroupedSection(details.student_available_slots, renderAvailableSlotRow, "green")}
                  </Space>
                </div>
              ) : null}
            </Space>
          )
        ) : groupedModalStaff.length === 0 ? (
          <Typography.Text type="secondary">No bookings or slots for this day.</Typography.Text>
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {groupedModalStaff.map((g) => (
              <Card key={`${g.slot_title}-${g.date}`} size="small" bodyStyle={{ padding: 14 }}>
                <Flex align="center" justify="space-between" wrap gap={12}>
                  <div>
                    <Space align="baseline" wrap size={8}>
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {g.slot_title}
                      </Typography.Title>
                      <Tag>{dayjs(g.date).format("ddd, MMM D")}</Tag>
                    </Space>
                    {g.slot_description ? (
                      <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                        {g.slot_description}
                      </Typography.Paragraph>
                    ) : null}
                  </div>
                  <Tag color="blue">
                    {g.booking_count} booking{g.booking_count === 1 ? "" : "s"}
                  </Tag>
                </Flex>
                <Divider style={{ margin: "12px 0" }} />
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {g.bookings.map((b, i) => (
                    <span key={`${g.slot_title}-${b.booking_id ?? i}-${i}`}>{renderStaffBookingRow(b)}</span>
                  ))}
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Modal>
    </Page>
  );
}
