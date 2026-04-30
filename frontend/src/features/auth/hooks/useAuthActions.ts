import { useCallback } from "react";

import { getMe, login as loginApi, register as registerApi } from "../api/authApi";
import type { LoginRequest, RegisterRequest } from "../api/authApi";
import { useAuthStore } from "../store/useAuthStore";

export function useAuthActions() {
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const login = useCallback(
    async (data: LoginRequest) => {
      const token = await loginApi(data);
      setToken(token.access_token);
      const me = await getMe();
      setUser(me);
      return me;
    },
    [setToken, setUser],
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      const user = await registerApi(data);
      return user;
    },
    [],
  );

  const hydrateMe = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      logout();
      return null;
    }
  }, [logout, setUser]);

  return { login, register, hydrateMe };
}

