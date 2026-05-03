import { apiClient } from "../apiClient";
import type { Classroom } from "../../../shared/types/domain";

export type CreateClassroomRequest = {
  name: string;
  capacity: number;
};

export type UpdateClassroomRequest = {
  name?: string | null;
  capacity?: number | null;
};

export async function getClassrooms(): Promise<Classroom[]> {
  const res = await apiClient.get<Classroom[]>("/classrooms/");
  return res.data;
}

export async function createClassroom(data: CreateClassroomRequest): Promise<Classroom> {
  const res = await apiClient.post<Classroom>("/classrooms/", data);
  return res.data;
}

export async function updateClassroom(classroomId: number, data: UpdateClassroomRequest): Promise<Classroom> {
  const res = await apiClient.put<Classroom>(`/classrooms/${classroomId}`, data);
  return res.data;
}

export async function deleteClassroom(classroomId: number): Promise<void> {
  await apiClient.delete(`/classrooms/${classroomId}`);
}

// Backwards-compatible aliases
export const listClassrooms = getClassrooms;

