import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import localizedFormat from "dayjs/plugin/localizedFormat";

let configured = false;

export const APP_TIMEZONE = "Asia/Almaty";

export function setupDayjs() {
  if (configured) return;
  configured = true;
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(relativeTime);
  dayjs.extend(localizedFormat);
  dayjs.tz.setDefault(APP_TIMEZONE);
}

/**
 * Convert any backend datetime to app timezone for display.
 * Backend stores UTC; some endpoints may already return +05:00.
 */
/**
 * Backend datetimes must be interpreted as UTC (even if the string has no 'Z').
 * Then we display them in the app timezone.
 */
export function dayjsToAppTz(value: string | Date) {
  return dayjs.utc(value).tz(APP_TIMEZONE);
}

/** Monday-start week (consistent with backend `weekday()` Mon=0 … Sun=6). */
export function mondayContaining(d: Dayjs): Dayjs {
  const dow = d.day(); // Sun 0 … Sat 6
  const delta = dow === 0 ? -6 : 1 - dow;
  return d.add(delta, "day").startOf("day");
}

export { dayjs };

