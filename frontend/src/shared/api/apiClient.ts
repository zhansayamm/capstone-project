import axios, { AxiosError, type AxiosInstance } from "axios";
import { notification } from "antd";

import { isJwtExpired } from "../utils/jwt";

type AuthStoreLike = {
  getState: () => {
    token: string | null;
    logout: () => void;
  };
};

let configured = false;
let authStoreRef: AuthStoreLike | null = null;

export const apiClient: AxiosInstance = axios.create({
  // Backend base URL (FastAPI). Configure via VITE_API_URL in frontend/.env.
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  timeout: 25_000,
});

const DEBUG_API = String(import.meta.env.VITE_DEBUG_API ?? "").toLowerCase() === "true";

type ApiErrorResponse = {
  error?: string;
  message?: string;
  detail?: string | unknown;
};

function redirectToLogin() {
  const url = new URL(window.location.href);
  const next = url.pathname + url.search + url.hash;
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("next", next);
  window.location.assign(loginUrl.toString());
}

function showErrorToast(title: string, description?: string) {
  notification.error({
    message: title,
    description,
    placement: "topRight",
    duration: 4,
  });
}

export function setupApiClient(authStore: AuthStoreLike) {
  authStoreRef = authStore;
  if (configured) return;
  configured = true;

  apiClient.interceptors.request.use((config) => {
    if (DEBUG_API) {
      const url = `${config.baseURL ?? ""}${config.url ?? ""}`;
      console.debug("[api] request", { method: config.method, url, data: config.data, params: config.params });
    }
    const token = authStoreRef?.getState().token;
    if (token) {
      if (isJwtExpired(token)) {
        authStoreRef?.getState().logout();
        redirectToLogin();
        return config;
      }
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (res) => {
      if (DEBUG_API) {
        console.debug("[api] response", { status: res.status, url: res.config.url, data: res.data });
      }
      return res;
    },
    (err: AxiosError<ApiErrorResponse>) => {
      if (DEBUG_API) {
        console.debug("[api] error", {
          message: err.message,
          code: err.code,
          status: err.response?.status,
          url: err.config?.url,
          data: err.response?.data,
        });
      }
      const status = err.response?.status;
      const data = err.response?.data;
      const apiMessage =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.detail === "string" && data.detail) ||
        (typeof data?.error === "string" && data.error) ||
        undefined;

      if (status === 401) {
        authStoreRef?.getState().logout();
        redirectToLogin();
        return Promise.reject(err);
      }

      if (err.code === "ERR_CANCELED") return Promise.reject(err);

      if (!err.response) {
        showErrorToast("Network error", "Check your connection and try again.");
        return Promise.reject(err);
      }

      if (status && status >= 500) {
        showErrorToast("Server error", apiMessage ?? "Please try again later.");
        return Promise.reject(err);
      }

      if (status === 409) {
        showErrorToast("Conflict", apiMessage ?? "This resource already exists or conflicts with existing data.");
        return Promise.reject(err);
      }

      if (status && status >= 400) {
        showErrorToast("Request failed", apiMessage ?? "Please review your input.");
      }
      return Promise.reject(err);
    },
  );
}

