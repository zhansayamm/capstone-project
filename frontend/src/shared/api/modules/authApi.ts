import { apiClient } from "../apiClient";
import type { TokenResponse, User, UserRole } from "../../../shared/types/auth";

export type LoginRequest = { email: string; password: string };

export type RegisterRequest = {
  email: string;
  password: string;
  role: UserRole;
  university_id: number;
  first_name?: string;
  last_name?: string;
};

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>("/auth/login", data);
  return res.data;
}

export async function register(data: RegisterRequest): Promise<User> {
  const res = await apiClient.post<User>("/auth/register", data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>("/auth/me");
  return res.data;
}

export async function listUniversities(): Promise<Array<{ id: number; name: string }>> {
  const res = await apiClient.get<Array<{ id: number; name: string }>>("/universities");
  return res.data;
}

export async function requestPasswordReset(email: string): Promise<{ message?: string } | void> {
  const res = await apiClient.post<{ message?: string }>("/auth/request-password-reset", { email });
  return res.data;
}

export async function resetPassword(data: { token: string; new_password: string }): Promise<{ message?: string } | void> {
  const res = await apiClient.post<{ message?: string }>("/auth/reset-password", data);
  return res.data;
}

