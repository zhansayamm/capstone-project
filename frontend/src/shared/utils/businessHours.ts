import type { Dayjs } from "dayjs";

const START_HOUR = 8;
const START_MINUTE = 30;
const END_HOUR = 17;
const END_MINUTE = 30;

export function isWithinBusinessHours(range: [Dayjs, Dayjs]): boolean {
  const [start, end] = range;
  if (!start || !end) return false;
  if (!start.isSame(end, "day")) return false;

  const startMinutes = start.hour() * 60 + start.minute();
  const endMinutes = end.hour() * 60 + end.minute();
  const min = START_HOUR * 60 + START_MINUTE;
  const max = END_HOUR * 60 + END_MINUTE;
  return startMinutes >= min && endMinutes <= max;
}

export function disabledTimeForBusinessHours(current: Dayjs | null, type: "start" | "end") {
  void current;
  void type;
  /* Ant Design DatePicker `disabledTime` signature; boundaries use fixed clocks below. */
  const disabledHours = () => {
    const hours: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (h < START_HOUR || h > END_HOUR) hours.push(h);
    }
    return hours;
  };

  const disabledMinutes = (selectedHour: number) => {
    const mins: number[] = [];
    for (let m = 0; m < 60; m++) {
      // Start boundary: 08:30+
      if (selectedHour === START_HOUR && m < START_MINUTE) mins.push(m);
      // End boundary: <=17:30
      if (selectedHour === END_HOUR && m > END_MINUTE) mins.push(m);
    }
    return mins;
  };

  return { disabledHours, disabledMinutes };
}

