import { parseHours, isOpenNow, getCurrentDayKey, type Hours } from "./hours";

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
