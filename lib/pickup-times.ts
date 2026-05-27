import { parseHours, isOpenNow, getCurrentDayKey, type Hours } from "./hours";

export interface PickupSlot {
  /** Customer-facing label, e.g. "ASAP (~15 min)" or "30 min". */
  label: string;
  /** Order-record value, e.g. "ASAP" or "12:30 PM". */
  value: string;
}

/**
 * Group raw pickup times into pill-friendly slots for the checkout UI:
 *   ASAP (~15 min), 15 min, 30 min, 45 min, 1 hr.
 * Falls back to whatever pickupTimes are available when the kitchen is closing
 * soon (fewer pills) and exposes the rest as "more times" the caller can hang
 * off a Select.
 */
export function generatePickupSlots(pickupTimes: string[]): {
  pills: PickupSlot[];
  more: string[];
} {
  if (pickupTimes.length === 0) return { pills: [], more: [] };
  const pills: PickupSlot[] = [];
  // ASAP pill (always first if present)
  const hasAsap = pickupTimes[0] === "ASAP";
  if (hasAsap) pills.push({ label: "ASAP (~15 min)", value: "ASAP" });
  const offsets = [
    { idx: hasAsap ? 1 : 0, label: "15 min" },
    { idx: hasAsap ? 2 : 1, label: "30 min" },
    { idx: hasAsap ? 3 : 2, label: "45 min" },
    { idx: hasAsap ? 4 : 3, label: "1 hr" },
  ];
  for (const o of offsets) {
    const t = pickupTimes[o.idx];
    if (!t) break;
    pills.push({ label: o.label, value: t });
  }
  // Anything after the 5 pills becomes the "more" dropdown
  const lastPillIdx = (hasAsap ? 1 : 0) + offsets.length - 1;
  const more = pickupTimes.slice(lastPillIdx + 1);
  return { pills, more };
}

/**
 * Generate pickup time options for today between now and close,
 * rounded up to the next quarter hour. Adds "ASAP" first.
 */
export function generatePickupTimes(hoursJson: string, now = new Date()): string[] {
  const hours = parseHours(hoursJson);
  const day = hours[getCurrentDayKey(now)];

  // Closed today → only ASAP (kitchen handles)
  if (!day || day.closed) return ["ASAP"];

  const [oh, om] = day.open.split(":").map(Number);
  const [ch, cm] = day.close.split(":").map(Number);
  const openMins = oh * 60 + om;
  const closeMins = ch * 60 + cm;

  let cursor: number;
  if (isOpenNow(hours, now)) {
    cursor = now.getHours() * 60 + now.getMinutes() + 20; // earliest = now + 20 min
    // Round up to next :00, :15, :30, :45
    cursor = Math.ceil(cursor / 15) * 15;
  } else if (now.getHours() * 60 + now.getMinutes() < openMins) {
    cursor = openMins;
  } else {
    return ["ASAP"]; // After close today
  }

  const slots: string[] = ["ASAP"];
  while (cursor <= closeMins - 15) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${hh}:${m.toString().padStart(2, "0")} ${period}`);
    cursor += 15;
  }
  return slots;
}
