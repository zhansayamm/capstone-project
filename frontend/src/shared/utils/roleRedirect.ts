import type { UserRole } from "../types/auth";

export function defaultRouteForRole(role: UserRole): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "professor") return "/professor/dashboard";
  return "/student/dashboard";
}

