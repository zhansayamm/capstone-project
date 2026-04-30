import { apiClient } from "../apiClient";
import type { Slot } from "../../../shared/types/domain";

export type CreateSlotRequest = {
  start_time: string;
  end_time: string;
};

export type ListSlotsParams = {
  limit?: number;
  offset?: number;
  professor_id?: number;
  available?: boolean;
  start_time_gte?: string;
  end_time_lte?: string;
};

export async function getSlots(params: ListSlotsParams = {}): Promise<Slot[]> {
  const res = await apiClient.get<Slot[]>("/slots", { params });
  return res.data;
}

export async function getMySlots(): Promise<Slot[]> {
  const res = await apiClient.get<Slot[]>("/slots/me");
  return res.data;
}

export async function createSlot(data: CreateSlotRequest): Promise<Slot> {
  const res = await apiClient.post<Slot>("/slots", data);
  return res.data;
}

export async function deleteSlot(slotId: number): Promise<void> {
  await apiClient.delete(`/slots/${slotId}`);
}

// Backwards-compatible aliases (older imports used by pages/features)
export const listSlots = getSlots;
export const listMySlots = getMySlots;

