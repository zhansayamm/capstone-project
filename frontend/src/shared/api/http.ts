import axios, { AxiosError, AxiosHeaders, type AxiosInstance } from "axios";
import { notification } from "antd";

import { API_URL } from "../../config/api";
import { isJwtExpired } from "../utils/jwt";

type AuthStoreLike = {
  getState: () => {
    token: string | null;
    logout: () => void;
  };
};

let configured = false;
let authStoreRef: AuthStoreLike | null = null;

export const http: AxiosInstance = axios.create({
  baseURL: String(API_URL || "http://localhost:8000"),
  timeout: 25_000,
  withCredentials: true,
});

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

export function setupHttpInterceptors(authStore: AuthStoreLike) {
  authStoreRef = authStore;
  if (configured) return;
  configured = true;

  http.interceptors.request.use((config) => {
    const token = authStoreRef?.getState().token;
    if (token) {
      if (isJwtExpired(token)) {
        authStoreRef?.getState().logout();
        redirectToLogin();
        return config;
      }
      const headers = AxiosHeaders.from(config.headers ?? {});
      headers.set("Authorization", `Bearer ${token}`);
      config.headers = headers;
    }
    return config;
  });

  http.interceptors.response.use(
    (res) => res,
    (err: AxiosError<ApiErrorResponse>) => {
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

      // Avoid spamming toasts for cancellations / network transitions.
      if (err.code === "ERR_CANCELED") return Promise.reject(err);

      if (!err.response) {
        showErrorToast("Network error", "Check your connection and try again.");
        return Promise.reject(err);
      }

      if (status && status >= 500) {
        showErrorToast("Server error", apiMessage ?? "Please try again later.");
        return Promise.reject(err);
      }

      // 4xx: show actionable message if present.
      if (status && status >= 400) {
        showErrorToast("Request failed", apiMessage ?? "Please review your input.");
      }
      return Promise.reject(err);
    },
  );
}

