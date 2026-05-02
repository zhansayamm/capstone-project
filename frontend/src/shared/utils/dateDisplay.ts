import { dayjsToAppTz } from "./dayjs";

export function formatDateTime(value: string | Date) {
  return dayjsToAppTz(value).format("DD MMM YYYY, HH:mm");
}

export function formatTime(value: string | Date) {
  return dayjsToAppTz(value).format("HH:mm");
}

export function formatRange(start: string | Date, end: string | Date) {
  return `${formatDateTime(start)} – ${formatTime(end)}`;
}

