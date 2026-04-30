import { useEffect, useRef } from "react";

export function usePolling(fn: () => void | Promise<void>, intervalMs: number, enabled: boolean) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        await fnRef.current();
      } catch {
        // global axios interceptor handles surfacing errors
      }
    };

    // run immediately then interval
    tick();
    const id = window.setInterval(() => {
      if (cancelled) return;
      tick();
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);
}

