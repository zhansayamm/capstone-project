import { apiClient } from "../apiClient";
import type { NotificationItem } from "../../../shared/types/domain";

export async function getMyNotifications(): Promise<NotificationItem[]> {
  const res = await apiClient.get<NotificationItem[]>("/notifications/me");
  return res.data;
}

export async function getUnreadNotifications(): Promise<NotificationItem[]> {
  const res = await apiClient.get<NotificationItem[]>("/notifications/unread");
  return res.data;
}

export async function markNotificationRead(notificationId: number): Promise<NotificationItem> {
  const res = await apiClient.patch<NotificationItem>(`/notifications/${notificationId}/read`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const res = await apiClient.patch<{ updated: number }>(`/notifications/me/read-all`);
  return res.data;
}

// Backwards-compatible aliases
export const listMyNotifications = getMyNotifications;
export const listUnreadNotifications = getUnreadNotifications;

