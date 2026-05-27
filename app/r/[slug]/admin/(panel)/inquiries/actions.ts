"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";

async function ensureAuth(slug: string) {
  const res = await requireRestaurantAdmin(slug);
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

const INQUIRY_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "scheduled",
  "closed",
  "spam",
] as const;

export async function updateInquiryStatus(input: {
  slug: string;
  id: string;
  status: (typeof INQUIRY_STATUSES)[number];
}) {
  const data = z
    .object({
      slug: z.string(),
      id: z.string(),
      status: z.enum(INQUIRY_STATUSES),
    })
    .parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const inq = await db.inquiry.findUnique({ where: { id: data.id } });
  if (!inq || inq.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Inquiry not found" };
  }
  await db.inquiry.update({
    where: { id: data.id },
    data: { status: data.status },
  });
  revalidatePath(`/r/${data.slug}/admin/inquiries`);
  revalidatePath(`/r/${data.slug}/admin`);
  return { ok: true as const };
}

export async function updateInquiryNotes(input: {
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
  const inq = await db.inquiry.findUnique({ where: { id: data.id } });
  if (!inq || inq.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Inquiry not found" };
  }
  await db.inquiry.update({
    where: { id: data.id },
    data: { notes: data.notes.trim() || null },
  });
  revalidatePath(`/r/${data.slug}/admin/inquiries`);
  return { ok: true as const };
}

export async function deleteInquiry(input: { slug: string; id: string }) {
  const { slug, id } = z
    .object({ slug: z.string(), id: z.string() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  const inq = await db.inquiry.findUnique({ where: { id } });
  if (!inq || inq.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Inquiry not found" };
  }
  await db.inquiry.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/inquiries`);
  return { ok: true as const };
}
