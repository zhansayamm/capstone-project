import { apiClient } from "../apiClient";
import type { UserMini } from "../../types/auth";

export async function downloadMyCalendarIcs(): Promise<Blob> {
  const res = await apiClient.get("/calendar/me", { responseType: "blob" });
  return res.data as Blob;
}

/** Month grid: sparse map of local calendar days (Asia/Almaty on server). */
export type DayPreviewItem = {
  title: string;
  time: string;
  kind: string;
  time_end?: string | null;
  booked?: number | null;
  capacity?: number | null;
  usage_band?: string | null;
};

export type DaySummary = {
  preview: DayPreviewItem[];
  more_count: number;
  /** Professor/Admin: green|orange|red|gray · Student: blue|purple|green|mixed|gray */
  state: string;
};

export type MonthSummaryResponse = {
  year: number;
  month: number;
  days: Record<string, DaySummary>;
};

/** UTC instants from server; display with `dayjsToAppTz`. */
export type WeekCalendarEvent = {
  date: string;
  title: string;
  kind: string;
  start: string;
  end: string;
};

export type WeekSummaryResponse = {
  week_start: string;
  events: WeekCalendarEvent[];
};

export type CalendarDayBookingRow = {
  booking_id: number | null;
  student: UserMini | null;
  professor?: UserMini | null;
  time_range: string;
  status: string;
  description: string | null;
  slot_id: number | null;
};

export type CalendarDayGroup = {
  slot_title: string;
  slot_description: string | null;
  date: string;
  booking_count: number;
  bookings: CalendarDayBookingRow[];
};

export type StudentReservationDetail = {
  classroom_name: string;
  time_range: string;
  created_at?: string | null;
};

export type DayDetailsResponse = {
  date: string;
  groups: CalendarDayGroup[];
  student_bookings?: CalendarDayGroup[] | null;
  student_reservations?: StudentReservationDetail[] | null;
  student_available_slots?: CalendarDayGroup[] | null;
};

export async function getMonthSummary(params: {
  year: number;
  month: number;
  include_bookings?: boolean;
  include_available_slots?: boolean;
}): Promise<MonthSummaryResponse> {
  const res = await apiClient.get<MonthSummaryResponse>("/calendar/month-summary", { params });
  return res.data;
}

/** Monday YYYY-MM-DD of the calendar week containing this date (server normalizes per LOCAL_TZ). */
export async function getWeekSummary(params: {
  week_start?: string;
  include_bookings?: boolean;
  include_available_slots?: boolean;
}): Promise<WeekSummaryResponse> {
  const res = await apiClient.get<WeekSummaryResponse>("/calendar/week-summary", { params });
  return res.data;
}

/** `date` = YYYY-MM-DD (interpreted as institution local calendar day on server). */
export async function getDayDetails(
  date: string,
  opts?: { include_bookings?: boolean; include_available_slots?: boolean },
): Promise<DayDetailsResponse> {
  const params: Record<string, string | boolean> = { date };
  if (opts?.include_bookings !== undefined) params.include_bookings = opts.include_bookings;
  if (opts?.include_available_slots !== undefined) params.include_available_slots = opts.include_available_slots;
  const res = await apiClient.get<DayDetailsResponse>("/calendar/day-details", { params });
  return res.data;
}

export type StudentScheduleResponse = {
  booked: Array<{
    id: number;
    status: "booked" | "queued" | string;
    created_at: string;
    slot: {
      id?: number;
      professor_id: number;
      university_id: number | null;
      start_time: string;
      end_time: string;
      is_booked?: boolean;
      professor?: UserMini | null;
    };
  }>;
  queued: Array<{
    id: number;
    status: "booked" | "queued" | string;
    created_at: string;
    slot: {
      id?: number;
      professor_id: number;
      university_id: number | null;
      start_time: string;
      end_time: string;
      is_booked?: boolean;
      professor?: UserMini | null;
    };
  }>;
  reservations: Array<{
    id: number;
    classroom_id: number;
    classroom_name: string;
    university_id: number | null;
    user_id: number;
    start_time: string;
    end_time: string;
    created_at: string;
  }>;
};

export async function getStudentSchedule(): Promise<StudentScheduleResponse> {
  const res = await apiClient.get<StudentScheduleResponse>("/calendar/student");
  return res.data;
}

export type ProfessorWeekScheduleResponse = Record<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  Array<{
    id: number;
    professor_id: number;
    university_id: number | null;
    start_time: string;
    end_time: string;
    is_booked: boolean;
    professor?: UserMini | null;
  }>
>;

export async function getProfessorWeekSchedule(): Promise<ProfessorWeekScheduleResponse> {
  const res = await apiClient.get<ProfessorWeekScheduleResponse>("/calendar/professor");
  return res.data;
}
