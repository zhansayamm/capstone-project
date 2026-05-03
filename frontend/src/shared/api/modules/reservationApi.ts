import { apiClient } from "../apiClient";
import type { Reservation } from "../../../shared/types/domain";

export type CreateReservationRequest = {
  classroom_id: number;
  start_time: string;
  end_time: string;
};

export async function createReservation(data: CreateReservationRequest): Promise<Reservation> {
  const res = await apiClient.post<Reservation>("/reservations/", data);
  return res.data;
}

export async function getMyReservations(params?: { limit?: number; offset?: number; upcoming?: boolean }): Promise<Reservation[]> {
  const res = await apiClient.get<Reservation[]>("/reservations/me", { params });
  return res.data;
}

export async function getReservations(params?: {
  limit?: number;
  offset?: number;
  classroom_id?: number;
  user_id?: number;
  upcoming?: boolean;
}): Promise<Reservation[]> {
  const res = await apiClient.get<Reservation[]>("/reservations/", { params });
  return res.data;
}

export async function cancelReservation(reservationId: number): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/reservations/${reservationId}`);
  return res.data;
}

// Backwards-compatible aliases
export const listMyReservations = getMyReservations;
export const listAllReservations = getReservations;

