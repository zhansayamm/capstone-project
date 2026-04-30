import { apiClient } from "../apiClient";
import type { User } from "../../types/auth";

export async function setMyAvatar(image_id: number): Promise<User> {
  const res = await apiClient.patch<User>("/users/me/avatar", { image_id });
  return res.data;
}

