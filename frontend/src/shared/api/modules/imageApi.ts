import { apiClient } from "../apiClient";

export type UploadImageResponse = { message: string; task_id: string };
export type ImageTaskStatus =
  | { status: "PENDING" | "STARTED" | "FAILURE" }
  | { status: "SUCCESS"; image_id?: number | null };

export async function uploadImage(file: File): Promise<UploadImageResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post<UploadImageResponse>("/images/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getImageTask(taskId: string): Promise<ImageTaskStatus> {
  const res = await apiClient.get<ImageTaskStatus>(`/images/tasks/${taskId}`);
  return res.data;
}

