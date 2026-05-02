import type { UserMini } from "./auth";

export type Slot = {
  id: number;
  professor_id: number;
  university_id: number | null;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  professor?: UserMini | null;
};

export type BookingStatus = "booked" | "queued";

export type Booking = {
  id: number;
  student_id: number;
  slot_id: number;
  university_id: number | null;
  status: BookingStatus;
  created_at: string;
  slot: Pick<Slot, "professor_id" | "university_id" | "start_time" | "end_time" | "professor">;
  queue_position?: number | null;
  student?: UserMini | null;
};

export type Classroom = {
  id: number;
  university_id: number | null;
  name: string;
  capacity: number;
};

export type Reservation = {
  id: number;
  classroom_id: number;
  classroom_name: string;
  university_id: number | null;
  user_id: number;
  start_time: string;
  end_time: string;
  created_at: string;
  user?: UserMini | null;
};

export type NotificationItem = {
  id: number;
  user_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
};

