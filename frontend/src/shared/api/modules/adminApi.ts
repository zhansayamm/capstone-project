import { apiClient } from "../apiClient";

export type AdminTotals = {
  total_users: number;
  total_slots: number;
  total_bookings: number;
  total_reservations: number;
};

export type BookingStats = { booked: number; queued: number };

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

