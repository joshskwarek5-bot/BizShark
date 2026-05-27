import {
  parseHours,
  isOpenNow,
  getCurrentDayKey,
  formatTime12,
  formatDayHours,
} from "./hours";

interface OrderingFields {
  isOrderingPaused: boolean;
  orderingHours: string | null;
  hours: string;
}

export type OrderingStatus =
  | { ok: true }
  | { ok: false; reason: "paused"; message: string }
  | { ok: false; reason: "closed_now"; message: string }
  | { ok: false; reason: "closed_today"; message: string };

/**
 * Should this client be accepting online orders right now?
 * Considers the manual pause toggle and optional separate ordering hours
 * (falls back to physical hours if `orderingHours` is null).
 */
export function canOrderNow(
  r: OrderingFields,
  now: Date = new Date()
): OrderingStatus {
  if (r.isOrderingPaused) {
    return {
      ok: false,
      reason: "paused",
      message: "Online ordering is paused right now.",
    };
  }

  const hoursJson = r.orderingHours ?? r.hours;
  const hours = parseHours(hoursJson);
  if (isOpenNow(hours, now)) {
    return { ok: true };
  }

  const day = hours[getCurrentDayKey(now)];
  if (!day || day.closed) {
    return {
      ok: false,
      reason: "closed_today",
      message: "Online ordering is closed today. Please call ahead.",
    };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = day.open.split(":").map(Number);
  if (minutes < oh * 60 + om) {
    return {
      ok: false,
      reason: "closed_now",
      message: `Online ordering opens at ${formatTime12(day.open)}.`,
    };
  }
  return {
    ok: false,
    reason: "closed_now",
    message: `Online ordering closed for today — we reopen tomorrow.`,
  };
}

/**
 * Tip presets are stored as a JSON-stringified array of percentages.
 * Defaults to [15,18,20,25] on parse failure.
 */
export function parseTipPresets(raw: string | null | undefined): number[] {
  if (!raw) return [15, 18, 20, 25];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((n) => Math.round(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    }
  } catch {}
  return [15, 18, 20, 25];
}

/**
 * Sanitize a free-form descriptor for Stripe's statement_descriptor_suffix:
 * letters/numbers/spaces only, max 22 chars, trimmed.
 */
export function sanitizeStatementDescriptor(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 22).trim();
}

/**
 * Human-readable description of when ordering is/isn't available, for the
 * customer-facing banner.
 */
export function describeOrdering(r: OrderingFields): string {
  if (r.isOrderingPaused) return "Online ordering is paused.";
  const hoursJson = r.orderingHours ?? r.hours;
  const hours = parseHours(hoursJson);
  const day = hours[getCurrentDayKey()];
  if (!day || day.closed) return "Online ordering closed today.";
  return `Online ordering today: ${formatDayHours(day)}`;
}
