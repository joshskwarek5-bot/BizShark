// Appointment availability engine. Pure functions — no DB access.
// Given the restaurant's weekly hours + booking config + already-booked
// appointments + service duration, return the list of HH:MM start times
// that are still available for a given date.
//
// All dates are interpreted in the SERVER's local timezone (TODO: per-
// restaurant tz when we add international support).

import { DAYS, getCurrentDayKey, parseHours, type DayKey, type Hours } from "./hours";

export interface AppointmentConfig {
  /** Master switch — when false, no slots are returned. */
  enabled: boolean;
  /** Length of each bookable slot in minutes (e.g. 30 = half-hour slots). */
  slotMinutes: number;
  /** Padding between back-to-back bookings (cleanup, walk-out, etc.). */
  bufferMinutes: number;
  /** Earliest a slot can be booked from now (e.g. 2 = no same-day < 2h ahead). */
  leadTimeHours: number;
  /** Hard cap on how far in advance a customer can book. */
  maxDaysAhead: number;
}

export const DEFAULT_APPOINTMENT_CONFIG: AppointmentConfig = {
  enabled: false,
  slotMinutes: 30,
  bufferMinutes: 0,
  leadTimeHours: 2,
  maxDaysAhead: 30,
};

export function parseAppointmentConfig(
  json: string | null | undefined
): AppointmentConfig {
  if (!json) return { ...DEFAULT_APPOINTMENT_CONFIG };
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_APPOINTMENT_CONFIG };
    const o = parsed as Record<string, unknown>;
    return {
      enabled: typeof o.enabled === "boolean" ? o.enabled : false,
      slotMinutes: clampInt(o.slotMinutes, 5, 240, 30),
      bufferMinutes: clampInt(o.bufferMinutes, 0, 120, 0),
      leadTimeHours: clampInt(o.leadTimeHours, 0, 168, 2),
      maxDaysAhead: clampInt(o.maxDaysAhead, 1, 365, 30),
    };
  } catch {
    return { ...DEFAULT_APPOINTMENT_CONFIG };
  }
}

export function serializeAppointmentConfig(cfg: AppointmentConfig): string {
  return JSON.stringify(cfg);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Existing bookings that may conflict with new ones. */
export interface BookedInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface SlotComputeInput {
  /** Target date (any time-of-day; we only use the calendar day). */
  date: Date;
  weeklyHours: Hours;
  config: AppointmentConfig;
  existingBookings: BookedInterval[];
  /** Duration of the SERVICE being booked, in minutes. */
  serviceDurationMinutes: number;
  /** "Now" — slots earlier than now+leadTime are excluded. Defaults to current Date. */
  now?: Date;
}

export interface AvailableSlot {
  /** HH:MM 24-hour. */
  time: string;
  /** Full datetime for the slot start in the server's local time. */
  startsAt: Date;
  /** Full datetime for the slot end (start + serviceDuration). */
  endsAt: Date;
}

/**
 * Compute the list of available slot start-times for a given date.
 * Excludes:
 *   - days the business is closed
 *   - times before now+leadTime
 *   - dates beyond maxDaysAhead
 *   - slots that would overlap an existing booking (including buffer)
 *   - slots whose end would extend past close
 */
export function computeAvailableSlots(
  input: SlotComputeInput
): AvailableSlot[] {
  const { date, weeklyHours, config, existingBookings, serviceDurationMinutes } = input;
  const now = input.now ?? new Date();

  if (!config.enabled) return [];
  if (serviceDurationMinutes <= 0) return [];

  // Beyond maxDaysAhead?
  const dayStart = startOfDay(date);
  const nowDayStart = startOfDay(now);
  const daysAhead = Math.round(
    (dayStart.getTime() - nowDayStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysAhead < 0) return []; // past
  if (daysAhead > config.maxDaysAhead) return [];

  // Which weekday?
  const dayKey: DayKey = jsDayToKey(date.getDay());
  const dayHours = weeklyHours[dayKey];
  if (!dayHours || dayHours.closed) return [];

  // Parse open + close minutes-of-day
  const open = parseHhmm(dayHours.open);
  const close = parseHhmm(dayHours.close);
  if (open === null || close === null || close <= open) return [];

  // Earliest allowed start (from lead time)
  const earliestAllowed = new Date(now.getTime() + config.leadTimeHours * 60 * 60 * 1000);

  const slots: AvailableSlot[] = [];
  const step = config.slotMinutes;
  const totalNeeded = serviceDurationMinutes + config.bufferMinutes;

  for (let minutesFromOpen = 0; ; minutesFromOpen += step) {
    const slotStartMin = open + minutesFromOpen;
    const slotEndMin = slotStartMin + serviceDurationMinutes;
    // The full needed footprint (including buffer) must fit before close
    if (slotStartMin + totalNeeded > close) break;
    if (slotEndMin > close) break;

    const startsAt = atMinutes(date, slotStartMin);
    const endsAt = atMinutes(date, slotEndMin);

    if (startsAt < earliestAllowed) continue;

    // Conflict detection: a candidate is in conflict if its [start, end+buffer)
    // overlaps any existing booking's [start, end+buffer).
    if (overlapsAny(startsAt, endsAt, existingBookings, config.bufferMinutes)) {
      continue;
    }

    slots.push({
      time: minutesToHhmm(slotStartMin),
      startsAt,
      endsAt,
    });
  }

  return slots;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function atMinutes(date: Date, minutesOfDay: number): Date {
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  x.setMinutes(minutesOfDay);
  return x;
}

const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function jsDayToKey(d: number): DayKey {
  return JS_DAY_TO_KEY[d];
}

function parseHhmm(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function minutesToHhmm(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

function overlapsAny(
  start: Date,
  end: Date,
  bookings: BookedInterval[],
  bufferMinutes: number
): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  for (const b of bookings) {
    // [start, end + buffer) vs [b.startsAt - buffer, b.endsAt + buffer)
    const bStart = new Date(b.startsAt.getTime() - bufferMs);
    const bEnd = new Date(b.endsAt.getTime() + bufferMs);
    const startMs = start.getTime();
    const endMs = end.getTime() + bufferMs;
    if (startMs < bEnd.getTime() && endMs > bStart.getTime()) {
      return true;
    }
  }
  return false;
}

/**
 * Format a datetime as a short display string like "Sat, May 30 · 2:00 PM".
 */
export function formatAppointmentDisplay(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Re-export for callers that want both in one import
export { parseHours, DAYS, getCurrentDayKey };
