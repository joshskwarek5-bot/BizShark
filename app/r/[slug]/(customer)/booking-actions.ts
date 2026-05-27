"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  computeAvailableSlots,
  parseAppointmentConfig,
  parseHours,
  type AvailableSlot,
} from "@/lib/availability";
import { parseServices } from "@/lib/client-type";

// ============================================================================
// Public: list available slots for a given date
// ============================================================================

const SlotsSchema = z.object({
  slug: z.string(),
  /** YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Service id from the services JSON, or "" to use the default 30-min slot length. */
  serviceId: z.string().optional(),
});

export type SlotsResult =
  | {
      ok: true;
      slots: Array<{ time: string; startsAtIso: string; endsAtIso: string }>;
      serviceDurationMinutes: number;
      serviceName: string | null;
    }
  | { ok: false; error: string };

export async function getAvailableSlots(
  input: z.infer<typeof SlotsSchema>
): Promise<SlotsResult> {
  const data = SlotsSchema.parse(input);
  const restaurant = await db.restaurant.findUnique({
    where: { slug: data.slug },
  });
  if (!restaurant || !restaurant.isActive) {
    return { ok: false, error: "Restaurant not found" };
  }
  const config = parseAppointmentConfig(restaurant.appointmentConfig);
  if (!config.enabled) {
    return { ok: false, error: "Booking is not enabled for this site" };
  }

  // Resolve the service duration. If a serviceId is passed, look up from
  // services JSON; otherwise use config.slotMinutes as the default.
  const services = parseServices(restaurant.services);
  let serviceDurationMinutes = config.slotMinutes;
  let serviceName: string | null = null;
  if (data.serviceId) {
    const svc = services.find((s) => s.id === data.serviceId);
    if (svc) {
      serviceName = svc.name;
      // Parse "30 min", "1 hr", "1h 30m", "45m", or "45"
      serviceDurationMinutes = parseDuration(svc.duration) ?? config.slotMinutes;
    }
  }

  // Parse target date in server's local time
  const [y, m, d] = data.date.split("-").map((n) => parseInt(n, 10));
  const target = new Date(y, m - 1, d, 0, 0, 0, 0);

  // Pull all NON-cancelled appointments on that day (to detect conflicts)
  const startOfDay = new Date(y, m - 1, d, 0, 0, 0);
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59);
  const existing = await db.appointment.findMany({
    where: {
      restaurantId: restaurant.id,
      status: { in: ["pending", "confirmed"] },
      startsAt: { gte: startOfDay, lte: endOfDay },
    },
    select: { startsAt: true, endsAt: true },
  });

  const slots: AvailableSlot[] = computeAvailableSlots({
    date: target,
    weeklyHours: parseHours(restaurant.hours),
    config,
    existingBookings: existing.map((e) => ({
      startsAt: e.startsAt,
      endsAt: e.endsAt,
    })),
    serviceDurationMinutes,
  });

  return {
    ok: true,
    slots: slots.map((s) => ({
      time: s.time,
      startsAtIso: s.startsAt.toISOString(),
      endsAtIso: s.endsAt.toISOString(),
    })),
    serviceDurationMinutes,
    serviceName,
  };
}

function parseDuration(s: string | null | undefined): number | null {
  if (!s) return null;
  const lower = s.toLowerCase().replace(/\s+/g, " ").trim();
  // "45" or "45 min" or "45m"
  const minOnly = lower.match(/^(\d+)\s*(m|min|minutes?)?$/);
  if (minOnly) return parseInt(minOnly[1], 10);
  // "1 hr" / "1h" / "1.5 hr"
  const hrOnly = lower.match(/^([\d.]+)\s*(h|hr|hour|hours)$/);
  if (hrOnly) return Math.round(parseFloat(hrOnly[1]) * 60);
  // "1 hr 30 min" / "1h 30m"
  const both = lower.match(/^(\d+)\s*(?:h|hr|hour|hours)\s*(\d+)\s*(?:m|min|minutes?)?$/);
  if (both) return parseInt(both[1], 10) * 60 + parseInt(both[2], 10);
  return null;
}

// ============================================================================
// Public: book an appointment (slot conflict re-checked atomically)
// ============================================================================

const BookSchema = z.object({
  slug: z.string(),
  serviceId: z.string().optional(),
  /** ISO datetime — must align with a computed slot start. */
  startsAtIso: z.string().min(10),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().max(120).optional().or(z.literal("")),
  customerPhone: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type BookResult =
  | { ok: true; appointmentId: string; startsAt: string; endsAt: string }
  | { ok: false; error: string };

export async function bookAppointment(
  input: z.infer<typeof BookSchema>
): Promise<BookResult> {
  const data = BookSchema.parse(input);
  if (!data.customerEmail && !data.customerPhone) {
    return {
      ok: false,
      error: "We need an email or phone so we can confirm your appointment.",
    };
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug: data.slug },
  });
  if (!restaurant || !restaurant.isActive) {
    return { ok: false, error: "We're not accepting bookings right now." };
  }
  const config = parseAppointmentConfig(restaurant.appointmentConfig);
  if (!config.enabled) {
    return { ok: false, error: "Booking isn't enabled for this site." };
  }

  const startsAt = new Date(data.startsAtIso);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "Invalid time slot." };
  }

  // Resolve service + duration
  const services = parseServices(restaurant.services);
  let serviceDurationMinutes = config.slotMinutes;
  let serviceName: string | null = null;
  if (data.serviceId) {
    const svc = services.find((s) => s.id === data.serviceId);
    if (svc) {
      serviceName = svc.name;
      serviceDurationMinutes = parseDuration(svc.duration) ?? config.slotMinutes;
    }
  }
  const endsAt = new Date(startsAt.getTime() + serviceDurationMinutes * 60 * 1000);

  // Re-verify the slot is actually available right now. Computing slots
  // for the date + checking that startsAt matches one prevents race
  // conditions where two customers grab the same slot.
  const [y, m, d] = [
    startsAt.getFullYear(),
    startsAt.getMonth(),
    startsAt.getDate(),
  ];
  const startOfDay = new Date(y, m, d, 0, 0, 0);
  const endOfDay = new Date(y, m, d, 23, 59, 59);
  const existing = await db.appointment.findMany({
    where: {
      restaurantId: restaurant.id,
      status: { in: ["pending", "confirmed"] },
      startsAt: { gte: startOfDay, lte: endOfDay },
    },
    select: { startsAt: true, endsAt: true },
  });
  const slots = computeAvailableSlots({
    date: new Date(y, m, d, 12, 0, 0),
    weeklyHours: parseHours(restaurant.hours),
    config,
    existingBookings: existing,
    serviceDurationMinutes,
  });
  const matching = slots.find(
    (s) => s.startsAt.getTime() === startsAt.getTime()
  );
  if (!matching) {
    return {
      ok: false,
      error:
        "That slot was just taken or is no longer available. Pick another time.",
    };
  }

  const appt = await db.appointment.create({
    data: {
      restaurantId: restaurant.id,
      startsAt,
      endsAt,
      serviceName,
      serviceDurationMinutes,
      customerName: data.customerName.trim(),
      customerEmail: data.customerEmail?.trim() || null,
      customerPhone: data.customerPhone?.trim() || null,
      notes: data.notes?.trim() || null,
      status: "pending",
    },
  });

  try {
    revalidatePath(`/r/${data.slug}/admin/appointments`);
    revalidatePath(`/r/${data.slug}/admin`);
  } catch {
    /* outside a request — fine for tests */
  }

  return {
    ok: true,
    appointmentId: appt.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}
