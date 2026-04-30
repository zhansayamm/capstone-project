import { apiClient } from "../apiClient";
import type { UserMini } from "../../types/auth";

export async function downloadMyCalendarIcs(): Promise<Blob> {
  const res = await apiClient.get("/calendar/me", { responseType: "blob" });
  return res.data as Blob;
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

