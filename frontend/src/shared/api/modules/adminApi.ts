import { apiClient } from "../apiClient";

export type AdminTotals = {
  total_users: number;
  total_slots: number;
  total_bookings: number;
  total_reservations: number;
};

export type BookingRollup = {
  awaiting_review: number;
  confirmed: number;
  rejected: number;
  cancelled: number;
};

/** Raw counts keyed by backend `BookingStatus` value. */
export type BookingByStatus = {
  pending: number;
  queued: number;
  approved: number;
  booked: number;
  rejected: number;
  cancelled: number;
};

export type BookingStats = {
  rollup: BookingRollup;
  by_status: BookingByStatus;
  total: number;
  /** Rows that did not match a known enum (should be rare). */
  unknown_status_count?: number;
};

export async function getTotals(): Promise<AdminTotals> {
  const res = await apiClient.get<AdminTotals>("/admin/stats");
  return res.data;
}

export async function getBookingStats(): Promise<BookingStats> {
  const res = await apiClient.get<BookingStats>("/admin/bookings");
  return res.data;
}

export async function getTopProfessors(): Promise<Array<{ professor_id: number; professor_name?: string | null; slots_created: number }>> {
  const res = await apiClient.get<Array<{ professor_id: number; professor_name?: string | null; slots_created: number }>>(
    "/admin/top-professors",
  );
  return res.data;
}

export async function getTopClassrooms(): Promise<Array<{ classroom_id: number; classroom_name?: string | null; reservations: number }>> {
  const res = await apiClient.get<Array<{ classroom_id: number; classroom_name?: string | null; reservations: number }>>(
    "/admin/top-classrooms",
  );
  return res.data;
}

