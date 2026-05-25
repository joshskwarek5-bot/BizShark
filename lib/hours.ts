export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

export interface DayHours {
  open: string; // "HH:MM" 24-hour
  close: string; // "HH:MM" 24-hour
  closed?: boolean;
  note?: string | null;
}

export type Hours = Record<DayKey, DayHours>;

export function parseHours(json: string | null | undefined): Hours {
  const empty: Hours = {
    mon: { open: "09:00", close: "17:00" },
    tue: { open: "09:00", close: "17:00" },
    wed: { open: "09:00", close: "17:00" },
    thu: { open: "09:00", close: "17:00" },
    fri: { open: "09:00", close: "17:00" },
    sat: { open: "09:00", close: "17:00" },
    sun: { open: "09:00", close: "17:00", closed: true },
  };
  if (!json) return empty;
  try {
    const parsed = JSON.parse(json);
    return { ...empty, ...parsed };
  } catch {
    return empty;
  }
}

export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatDayHours(day: DayHours): string {
  if (day.closed) return "Closed";
  return `${formatTime12(day.open)} – ${formatTime12(day.close)}`;
}

const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function getCurrentDayKey(now = new Date()): DayKey {
  return JS_DAY_TO_KEY[now.getDay()];
}

export function isOpenNow(hours: Hours, now = new Date()): boolean {
  const day = hours[getCurrentDayKey(now)];
  if (!day || day.closed) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = day.open.split(":").map(Number);
  const [ch, cm] = day.close.split(":").map(Number);
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  return minutes >= open && minutes < close;
}

export function openStatus(hours: Hours, now = new Date()): { open: boolean; label: string } {
  const day = hours[getCurrentDayKey(now)];
  if (!day || day.closed) {
    return { open: false, label: "Closed today" };
  }
  const open = isOpenNow(hours, now);
  if (open) {
    return { open: true, label: `Open until ${formatTime12(day.close)}` };
  }
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = day.open.split(":").map(Number);
  if (minutes < oh * 60 + om) {
    return { open: false, label: `Opens at ${formatTime12(day.open)}` };
  }
  return { open: false, label: "Closed for the day" };
}
