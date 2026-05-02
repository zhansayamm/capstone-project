import { useEffect } from "react";

import { useAuthActions } from "../features/auth/hooks/useAuthActions";
import { useAuthStore } from "../features/auth/store/useAuthStore";

/**
 * After persist rehydration, refresh session from API when a token exists so
 * `user`/`isAuthenticated` are consistent before route guards run.
 */
export function AuthBootstrap() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const { hydrateMe } = useAuthActions();

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function run() {
      const t = useAuthStore.getState().token;
      if (!t) {
        useAuthStore.getState().setAuthReady(true);
        return;
      }
      await hydrateMe();
      if (!cancelled) {
        useAuthStore.getState().setAuthReady(true);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, hydrateMe]);

  return null;
}
