"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const InquirySchema = z.object({
  slug: z.string(),
  kind: z.enum(["quote", "contact", "appointment"]),
  name: z.string().min(1).max(120),
  email: z.string().email().max(120).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  serviceRequested: z.string().max(200).optional().or(z.literal("")),
  preferredDate: z.string().max(40).optional().or(z.literal("")),
  preferredTime: z.string().max(40).optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
});

export async function submitInquiry(input: z.infer<typeof InquirySchema>) {
  const parsed = InquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Please check the form",
    };
  }
  const data = parsed.data;
  const r = await db.restaurant.findUnique({ where: { slug: data.slug } });
  if (!r || !r.isActive) {
    return { ok: false as const, error: "We're not accepting requests right now." };
  }
  // Cheap spam guard: must have at least one contact method
  if (!data.email && !data.phone) {
    return {
      ok: false as const,
      error: "Add an email or phone so we can get back to you.",
    };
  }
  await db.inquiry.create({
    data: {
      restaurantId: r.id,
      kind: data.kind,
      customerName: data.name.trim(),
      customerEmail: data.email?.trim() || null,
      customerPhone: data.phone?.trim() || null,
      message: data.message?.trim() || null,
      serviceRequested: data.serviceRequested?.trim() || null,
      preferredDate: data.preferredDate?.trim() || null,
      preferredTime: data.preferredTime?.trim() || null,
      address: data.address?.trim() || null,
      status: "new",
    },
  });
  // revalidatePath fails when called outside a request context (e.g. from an
  // audit script). Wrap so the inquiry is still saved either way.
  try {
    revalidatePath(`/r/${data.slug}/admin`);
    revalidatePath(`/r/${data.slug}/admin/inquiries`);
  } catch {
    /* not in a request — safe to ignore */
  }
  return { ok: true as const };
}
