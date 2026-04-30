import { useCallback, useState } from "react";

export type AsyncState<T> = {
  loading: boolean;
  error: unknown;
  value: T | null;
};

export function useAsync<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
): {
  state: AsyncState<T>;
  run: (...args: A) => Promise<T>;
  reset: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({
    loading: false,
    error: null,
    value: null,
  });

  const run = useCallback(
    async (...args: A) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const value = await fn(...args);
        setState({ loading: false, error: null, value });
        return value;
      } catch (e) {
        setState({ loading: false, error: e, value: null });
        throw e;
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, value: null });
  }, []);

  return { state, run, reset };
}

