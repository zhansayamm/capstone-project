import { Button, Spin, Typography, theme } from "antd";
import type { Dayjs } from "dayjs";
import { useMemo } from "react";
import type { CSSProperties } from "react";

import type { WeekCalendarEvent } from "../../shared/api/modules/calendarApi";
import { dayjsToAppTz, dayjs } from "../../shared/utils/dayjs";

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 18;
const PX_PER_HOUR = 60;
const PX_PER_MIN = PX_PER_HOUR / 60;
const ROW_HEADER_H = 40;
const TIME_COL_WIDTH = 56;
const DAY_MIN_WIDTH_STUDENT = 96;
const DAY_MIN_WIDTH_STAFF = 108;

const BOOKING_BLUE = "rgba(22, 119, 255, 0.92)";
const RES_PURPLE = "rgba(114, 46, 209, 0.88)";
const SLOT_GREEN = "#52c41a";
const STAFF_FREE_OUTLINE = "rgba(82, 196, 26, 0.55)";
const ADMIN_FULL_BG = "rgba(255, 77, 79, 0.18)";
const ADMIN_FULL_BORDER = "rgba(255, 77, 79, 0.65)";

export type CalendarWeekViewerRole = "student" | "professor" | "admin";

function minutesSinceDayStart(inst: Dayjs): number {
  return inst.hour() * 60 + inst.minute() + inst.second() / 60;
}

/** Top offset relative to GRID_START_HOUR (px). */
function topPx(inst: Dayjs): number {
  const origin = GRID_START_HOUR * 60;
  return Math.max(0, minutesSinceDayStart(inst) - origin) * PX_PER_MIN;
}

/** Height (px), clamped to grid bounds for this column day; min height for readability. */
function clampedBlock(instLo: Dayjs, instHi: Dayjs, colDayStart: Dayjs): { top: number; h: number } | null {
  const gridLo = colDayStart.hour(GRID_START_HOUR).minute(0).second(0).millisecond(0);
  const gridHi = colDayStart.hour(GRID_END_HOUR).minute(0).second(0).millisecond(0);
  if (!instHi.isAfter(instLo)) return null;
  const viLo = Math.max(instLo.valueOf(), gridLo.valueOf());
  const viHi = Math.min(instHi.valueOf(), gridHi.valueOf());
  if (!(viHi > viLo)) return null;
  const loApp = dayjs(viLo);
  const hiApp = dayjs(viHi);
  const t = topPx(loApp);
  const mins = hiApp.diff(loApp, "minute", true);
  const h = Math.max(mins * PX_PER_MIN, 28);
  return { top: t, h };
}

function eventChipStyle(kind: string): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    boxSizing: "border-box",
    borderRadius: 6,
    padding: "4px 6px",
    cursor: "pointer",
    overflow: "hidden",
    fontSize: 11,
    lineHeight: 1.25,
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
  };

  switch (kind) {
    case "booking":
      return { ...base, background: BOOKING_BLUE, color: "#fff", border: "none" };
    case "reservation":
      return { ...base, background: RES_PURPLE, color: "#fff", border: "none" };
    case "slot":
      return {
        ...base,
        background: "#fff",
        color: "rgba(0,0,0,0.85)",
        border: `2px solid ${SLOT_GREEN}`,
      };
    case "slot_booked":
    case "booking_pending":
    case "booking_other":
      return { ...base, background: BOOKING_BLUE, color: "#fff", border: "none" };
    case "slot_free":
      return {
        ...base,
        background: "rgba(246,255,237,0.95)",
        color: "rgba(0,77,48,0.88)",
        border: `2px solid ${STAFF_FREE_OUTLINE}`,
      };
    case "slot_full":
      return {
        ...base,
        background: ADMIN_FULL_BG,
        color: "#a61d24",
        border: `2px solid ${ADMIN_FULL_BORDER}`,
      };
    case "slot_open":
      return {
        ...base,
        background: "#fff",
        color: "rgba(0,0,0,0.85)",
        border: `2px solid ${SLOT_GREEN}`,
      };
    default:
      return { ...base, background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.78)", border: `1px solid rgba(0,0,0,0.12)` };
  }
}

type LanePos = {
  ev: WeekCalendarEvent;
  laneIndex: number;
  laneCount: number;
};

/** Column packing for overlaps (Greedy lanes by end-time). */
function layoutLanes(dayEvents: WeekCalendarEvent[]): LanePos[] {
  const sorted = [...dayEvents].sort((a, b) => dayjsToAppTz(a.start).valueOf() - dayjsToAppTz(b.start).valueOf());
  const laneEnds: number[] = [];
  const out: Omit<LanePos, "laneCount">[] = [];

  for (const ev of sorted) {
    const startMs = dayjsToAppTz(ev.start).valueOf();
    const endMs = dayjsToAppTz(ev.end).valueOf();
    let laneIdx = laneEnds.findIndex((laneEndTs) => laneEndTs <= startMs);
    if (laneIdx < 0) {
      laneIdx = laneEnds.length;
      laneEnds.push(endMs);
    } else {
      laneEnds[laneIdx] = endMs;
    }
    out.push({ ev, laneIndex: laneIdx });
  }
  const n = laneEnds.length || 1;
  return out.map((o) => ({ ...o, laneCount: n }));
}

type CalendarWeekGridProps = {
  weekMonday: Dayjs;
  events: WeekCalendarEvent[];
  loading?: boolean;
  role: CalendarWeekViewerRole;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  onOpenDay: (dateIso: string) => void;
};

export function CalendarWeekGrid({
  weekMonday,
  events,
  loading,
  role,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onOpenDay,
}: CalendarWeekGridProps) {
  const { token } = theme.useToken();
  const dayMinWidth = role === "student" ? DAY_MIN_WIDTH_STUDENT : DAY_MIN_WIDTH_STAFF;

  const dayColumns = useMemo(() => {
    const cols: Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      cols.push(weekMonday.add(i, "day").startOf("day"));
    }
    return cols;
  }, [weekMonday]);

  const slotsByDay = useMemo(() => {
    const m = new Map<string, WeekCalendarEvent[]>();
    for (const d of dayColumns) {
      m.set(d.format("YYYY-MM-DD"), []);
    }
    for (const ev of events) {
      let list = m.get(ev.date);
      if (!list) {
        const alt = dayjsToAppTz(ev.start).format("YYYY-MM-DD");
        list = m.get(alt);
      }
      if (list) list.push(ev);
    }
    for (const list of m.values()) {
      list.sort((a, b) => dayjsToAppTz(a.start).valueOf() - dayjsToAppTz(b.start).valueOf());
    }
    return m;
  }, [events, dayColumns]);

  const gridBodyHeight = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR;

  const halfHourMarks = useMemo(() => {
    const out: number[] = [];
    for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
      out.push(h);
      out.push(h + 0.5);
    }
    return out;
  }, []);

  function markTopPx(t: number): number {
    const hh = Math.floor(t);
    const mm = Math.round((t % 1) * 60);
    return (hh - GRID_START_HOUR) * PX_PER_HOUR + (mm / 60) * PX_PER_HOUR;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto" }}>
      <div
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          paddingBottom: 10,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text strong>
          Week of {weekMonday.format("MMM D")}
          {" – "}
          {weekMonday.add(6, "day").format("MMM D, YYYY")}
        </Typography.Text>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="small" onClick={onPrevWeek}>
            Previous
          </Button>
          <Button size="small" onClick={onThisWeek}>
            This week
          </Button>
          <Button size="small" onClick={onNextWeek}>
            Next
          </Button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          overflow: "hidden",
          marginTop: 8,
          flex: "1 1 auto",
          minHeight: 0,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
        }}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 260 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)", minHeight: 320 }}>
            <div style={{ minWidth: TIME_COL_WIDTH + 7 * dayMinWidth }}>
              {/* Sticky-ish header */}
              <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 4, background: token.colorBgContainer }}>
                <div style={{ flex: `0 0 ${TIME_COL_WIDTH}px`, height: ROW_HEADER_H, borderBottom: `1px solid ${token.colorBorderSecondary}` }} />
                {dayColumns.map((d) => (
                  <div
                    key={`h-${d.format("YYYY-MM-DD")}`}
                    style={{
                      flex: `1 1 ${dayMinWidth}px`,
                      minWidth: dayMinWidth,
                      height: ROW_HEADER_H,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      background: token.colorFillAlter,
                      padding: 2,
                    }}
                  >
                    <Typography.Text strong style={{ fontSize: 12 }}>
                      {d.format("ddd")}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {d.format("MMM D")}
                    </Typography.Text>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex" }}>
                <div style={{ flex: `0 0 ${TIME_COL_WIDTH}px`, position: "relative", height: gridBodyHeight }}>
                        {halfHourMarks.map((t) => {
                    const hh = Math.floor(t);
                    const mm = Math.round((t % 1) * 60);
                    const lab = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
                    const y = markTopPx(t);
                    return (
                      <Typography.Text
                        key={lab}
                        type="secondary"
                        style={{
                          position: "absolute",
                          top: y,
                          right: 4,
                          fontSize: 10,
                          lineHeight: 1,
                          transform: "translateY(-50%)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lab}
                      </Typography.Text>
                    );
                  })}
                </div>

                {dayColumns.map((colDay) => {
                  const key = colDay.format("YYYY-MM-DD");
                  const laneItems = layoutLanes(slotsByDay.get(key) ?? []);
                  return (
                    <div
                      key={key}
                      style={{
                        flex: `1 1 ${dayMinWidth}px`,
                        minWidth: dayMinWidth,
                        borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          height: gridBodyHeight,
                          backgroundImage: `
                            repeating-linear-gradient(
                              to bottom,
                              ${token.colorFillQuaternary},
                              ${token.colorFillQuaternary} ${PX_PER_HOUR}px,
                              transparent ${PX_PER_HOUR}px,
                              transparent ${2 * PX_PER_HOUR}px
                            )
                          `,
                        }}
                      >
                        {halfHourMarks.map((t) => {
                          const hh = Math.floor(t);
                          const mm = Math.round((t % 1) * 60);
                          const topPxMark = markTopPx(t);
                          const bold = mm === 0;
                          return (
                            <div
                              key={`line-${key}-${hh}-${mm}`}
                              style={{
                                position: "absolute",
                                top: topPxMark,
                                left: 0,
                                right: 0,
                                pointerEvents: "none",
                                borderTop: bold ? `1px solid ${token.colorBorderSecondary}` : `1px dashed rgba(0,0,0,0.06)`,
                              }}
                            />
                          );
                        })}

                        {laneItems.map(({ ev, laneIndex, laneCount }) => {
                          const rawStart = dayjsToAppTz(ev.start);
                          const rawEnd = dayjsToAppTz(ev.end);
                          // Only paint event on columns where LOCAL date matches start date (covers normal single-day items).
                          if (rawStart.format("YYYY-MM-DD") !== key) return null;
                          const boxed = clampedBlock(rawStart, rawEnd, colDay);
                          if (!boxed) return null;

                          const wPct = 100 / laneCount;
                          const leftPct = wPct * laneIndex;

                          return (
                            <div
                              key={`${ev.start}-${ev.end}-${laneIndex}-${ev.title}-${ev.kind}`}
                              role="presentation"
                              onClick={() => onOpenDay(ev.date)}
                              title={ev.title}
                              style={{
                                ...eventChipStyle(ev.kind),
                                top: boxed.top + 2,
                                height: Math.max(boxed.h - 4, 24),
                                left: `calc(${leftPct}% + 3px)`,
                                width: `calc(${wPct}% - 6px)`,
                              }}
                            >
                              <Typography.Text ellipsis style={{ fontSize: 11, color: "inherit", fontWeight: 600, margin: 0, lineHeight: "14px" }}>
                                {ev.title}
                              </Typography.Text>
                              <span style={{ fontSize: 10, opacity: 0.92, color: "inherit", whiteSpace: "nowrap", marginTop: 2 }}>
                                {`${rawStart.format("HH:mm")}–${rawEnd.format("HH:mm")}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
