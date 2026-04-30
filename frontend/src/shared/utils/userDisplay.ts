import type { UserMini } from "../types/auth";

export function formatUserName(user?: UserMini | null, fallback?: { id?: number; email?: string } | null) {
  const fn = user?.first_name?.trim();
  const ln = user?.last_name?.trim();
  const full = [fn, ln].filter(Boolean).join(" ");
  if (full) return full;
  if (user?.email) return user.email;
  if (fallback?.email) return fallback.email;
  if (typeof fallback?.id === "number") return `#${fallback.id}`;
  return "—";
}

