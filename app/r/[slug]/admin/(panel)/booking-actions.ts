"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import {
  serializeAppointmentConfig,
  type AppointmentConfig,
} from "@/lib/availability";

async function ensureAuth(slug: string) {
  const res = await requireRestaurantAdmin(slug);
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

// ============================================================================
// Admin: update appointment config
// ============================================================================

const ConfigSchema = z.object({
  slug: z.string(),
  enabled: z.boolean(),
  slotMinutes: z.number().int().min(5).max(240),
  bufferMinutes: z.number().int().min(0).max(120),
  leadTimeHours: z.number().int().min(0).max(168),
  maxDaysAhead: z.number().int().min(1).max(365),
});

export async function updateAppointmentConfig(
  input: z.infer<typeof ConfigSchema>
) {
  const data = ConfigSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const config: AppointmentConfig = {
    enabled: data.enabled,
    slotMinutes: data.slotMinutes,
    bufferMinutes: data.bufferMinutes,
    leadTimeHours: data.leadTimeHours,
    maxDaysAhead: data.maxDaysAhead,
  };
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: { appointmentConfig: serializeAppointmentConfig(config) },
  });
  revalidatePath(`/r/${data.slug}/admin/booking`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const };
}

// ============================================================================
// Admin: appointment status management
// ============================================================================

const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "declined",
  "completed",
  "cancelled",
  "no_show",
] as const;

export async function updateAppointmentStatus(input: {
  slug: string;
  id: string;
  status: (typeof APPOINTMENT_STATUSES)[number];
}) {
  const data = z
    .object({
      slug: z.string(),
      id: z.string(),
      status: z.enum(APPOINTMENT_STATUSES),
    })
    .parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const appt = await db.appointment.findUnique({ where: { id: data.id } });
  if (!appt || appt.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Appointment not found" };
  }
  await db.appointment.update({
    where: { id: data.id },
    data: {
      status: data.status,
      cancelledAt:
        data.status === "cancelled" || data.status === "declined"
          ? new Date()
          : appt.cancelledAt,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/appointments`);
  revalidatePath(`/r/${data.slug}/admin`);
  return { ok: true as const };
}

export async function updateAppointmentNotes(input: {
  slug: string;
  id: string;
  notes: string;
}) {
  const data = z
    .object({
      slug: z.string(),
      id: z.string(),
      notes: z.string().max(4000),
    })
    .parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const appt = await db.appointment.findUnique({ where: { id: data.id } });
  if (!appt || appt.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Appointment not found" };
  }
  await db.appointment.update({
    where: { id: data.id },
    data: { adminNotes: data.notes.trim() || null },
  });
  revalidatePath(`/r/${data.slug}/admin/appointments`);
  return { ok: true as const };
}

export async function deleteAppointment(input: { slug: string; id: string }) {
  const { slug, id } = z
    .object({ slug: z.string(), id: z.string() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  const appt = await db.appointment.findUnique({ where: { id } });
  if (!appt || appt.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Not found" };
  }
  await db.appointment.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/appointments`);
  return { ok: true as const };
}
