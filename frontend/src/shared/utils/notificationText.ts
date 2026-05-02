import { dayjs } from "./dayjs";
import { formatDateTime } from "./dateDisplay";

// Matches:
// - "2026-05-06 03:30:00"
// - "2026-05-06T03:30:00"
// - with optional timezone suffix ("Z" or "+05:00")
const DATE_TIME_RE =
  /\b(\d{4}-\d{2}-\d{2})(?:[ T])(\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?\b/g;

export function formatNotificationMessage(message: string) {
  return message.replace(DATE_TIME_RE, (full, date, time, tz) => {
    const iso = `${date}T${time}${tz ?? ""}`;
    const parsed = dayjs.utc(iso);
    if (!parsed.isValid()) return full;
    return formatDateTime(iso);
  });
}

