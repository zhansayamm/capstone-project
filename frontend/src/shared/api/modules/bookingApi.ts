import { apiClient } from "../apiClient";
import type { Booking } from "../../../shared/types/domain";

export async function bookSlot(slot_id: number): Promise<Booking> {
  const res = await apiClient.post<Booking>("/bookings", { slot_id });
  return res.data;
}

export async function getMyBookings(params?: { limit?: number; offset?: number; upcoming?: boolean }): Promise<Booking[]> {
  const res = await apiClient.get<Booking[]>("/bookings/me", { params });
  return res.data;
}

export async function getProfessorBookings(params?: { limit?: number; offset?: number; upcoming?: boolean }): Promise<Booking[]> {
  const res = await apiClient.get<Booking[]>("/bookings/professor", { params });
  return res.data;
}

export async function getBookings(params?: { limit?: number; offset?: number; upcoming?: boolean }): Promise<Booking[]> {
  const res = await apiClient.get<Booking[]>("/bookings", { params });
  return res.data;
}

export async function cancelBooking(bookingId: number): Promise<void> {
  await apiClient.delete(`/bookings/${bookingId}`);
}

// Backwards-compatible aliases
export const createBooking = bookSlot;
export const listMyBookings = getMyBookings;
export const listProfessorBookings = getProfessorBookings;
export const listAllBookings = getBookings;

