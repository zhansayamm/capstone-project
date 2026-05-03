import { apiClient } from "../apiClient";
import type { Booking, BookingMessage } from "../../../shared/types/domain";

export type CreateBookingRequest = { slot_id: number; description?: string | null; participants?: number[] | null };

export async function bookSlot(slot_id_or_payload: number | CreateBookingRequest, description?: string | null): Promise<Booking> {
  const payload: CreateBookingRequest =
    typeof slot_id_or_payload === "number"
      ? { slot_id: slot_id_or_payload, description: description ?? null }
      : {
          slot_id: slot_id_or_payload.slot_id,
          description: slot_id_or_payload.description ?? null,
          participants: slot_id_or_payload.participants ?? null,
        };
  const res = await apiClient.post<Booking>("/bookings/", payload);
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
  const res = await apiClient.get<Booking[]>("/bookings/", { params });
  return res.data;
}

export async function cancelBooking(bookingId: number): Promise<void> {
  await apiClient.delete(`/bookings/${bookingId}`);
}

export async function approveBooking(bookingId: number): Promise<Booking> {
  const res = await apiClient.post<Booking>(`/bookings/${bookingId}/approve`);
  return res.data;
}

export async function rejectBooking(bookingId: number): Promise<Booking> {
  const res = await apiClient.post<Booking>(`/bookings/${bookingId}/reject`);
  return res.data;
}

export async function listBookingMessages(
  bookingId: number,
  params?: { limit?: number; offset?: number },
): Promise<BookingMessage[]> {
  const res = await apiClient.get<BookingMessage[]>(`/bookings/${bookingId}/messages`, { params });
  return res.data;
}

export async function postBookingMessage(bookingId: number, message: string): Promise<BookingMessage> {
  const res = await apiClient.post<BookingMessage>(`/bookings/${bookingId}/messages`, { message });
  return res.data;
}

// Backwards-compatible aliases
export const createBooking = bookSlot;
export const listMyBookings = getMyBookings;
export const listProfessorBookings = getProfessorBookings;
export const listAllBookings = getBookings;

