export type UserRole = "student" | "professor" | "admin";

export type TokenResponse = {
  access_token: string;
  token_type: "bearer" | string;
};

export type JwtPayload = {
  user_id?: number;
  role?: UserRole;
  exp?: number;
  [k: string]: unknown;
};

export type User = {
  id: number;
  email: string;
  role: UserRole;
  university_id: number | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_image_id?: number | null;
};

export type UserMini = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

