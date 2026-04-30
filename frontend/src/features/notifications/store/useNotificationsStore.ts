import { create } from "zustand";

import type { NotificationItem } from "../../../shared/types/domain";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from "../../notifications/api/notificationApi";

type NotificationsState = {
  items: NotificationItem[];
  loading: boolean;
  lastFetchedAt: number | null;
  unreadCount: number;
  fetch: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

function computeUnread(items: NotificationItem[]): number {
  return items.reduce((acc, n) => acc + (n.is_read ? 0 : 1), 0);
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  loading: false,
  lastFetchedAt: null,
  unreadCount: 0,
  fetch: async () => {
    set({ loading: true });
    try {
      const items = await getMyNotifications();
      set({
        items,
        lastFetchedAt: Date.now(),
        unreadCount: computeUnread(items),
        loading: false,
      });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },
  markRead: async (id) => {
    await markNotificationRead(id);
    // Optimistic local update then refresh counts.
    const next = get().items.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    set({ items: next, unreadCount: computeUnread(next) });
  },
  markAllRead: async () => {
    await markAllNotificationsRead();
    const next = get().items.map((n) => ({ ...n, is_read: true }));
    set({ items: next, unreadCount: 0 });
  },
}));

