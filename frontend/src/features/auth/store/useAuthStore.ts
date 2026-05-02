import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User, UserRole } from "../../../shared/types/auth";
import { isJwtExpired } from "../../../shared/utils/jwt";

type AuthState = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  /** True after persist rehydration and any required /auth/me bootstrap (safe for route guards). */
  authReady: boolean;
  setHydrated: () => void;
  setAuthReady: (ready: boolean) => void;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
};

const STORAGE_KEY = "booking-time.auth";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      hydrated: false,
      authReady: false,
      setHydrated: () => set({ hydrated: true }),
      setAuthReady: (ready) => set({ authReady: ready }),
      setToken: (token) =>
        set({
          token,
          isAuthenticated: token ? !isJwtExpired(token) : false,
        }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({ token: null, user: null, isAuthenticated: false, authReady: true }),
      hasRole: (roles) => {
        const role = get().user?.role;
        return role ? roles.includes(role) : false;
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        const token = state?.token ?? null;
        if (token) {
          state?.setToken(token);
        }
        // No token: guards can proceed without waiting for hydrateMe().
        else {
          state?.setAuthReady(true);
        }
        state?.setHydrated();
      },
    },
  ),
);

