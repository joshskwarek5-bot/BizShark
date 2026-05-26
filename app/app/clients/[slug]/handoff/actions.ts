"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";

async function ensureOwnedRestaurant(slug: string) {
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const r = await db.restaurant.findUnique({ where: { slug } });
  if (!r) throw new Error("not_found");
  if (r.operatorId !== auth.operator.id) throw new Error("forbidden");
  return { operator: auth.operator, restaurant: r };
}

const CreateLinkSchema = z.object({
  slug: z.string(),
  email: z.string().email().max(120),
  name: z.string().max(120).optional(),
  ttlDays: z.number().int().min(1).max(30).default(7),
});

export interface CreateSetupLinkResult {
  ok: boolean;
  url?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * Generate a one-time setup link the operator shares with the client owner.
 * Lands on /setup/<token>, owner picks a password, becomes restaurant_admin.
 *
 * Returns the full URL (relative to current origin — caller should join with
 * window.location.origin since we don't have it server-side). For now we
 * return a token + relative path; the client will compose the full URL.
 */
export async function createSetupLink(
  input: z.input<typeof CreateLinkSchema>
): Promise<CreateSetupLinkResult> {
  const parsed = CreateLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const { operator, restaurant } = await ensureOwnedRestaurant(data.slug);

  const email = data.email.toLowerCase().trim();

  // Refuse if a User with this email already exists — they should sign in
  // instead, not get a setup link that'd clash.
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      ok: false,
      error: `A user with email ${email} already exists. They can sign in at /login.`,
    };
  }

  // Invalidate any prior unused links for this restaurant — only one
  // outstanding at a time keeps things tidy.
  await db.setupLink.deleteMany({
    where: { restaurantId: restaurant.id, usedAt: null },
  });

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + data.ttlDays * 24 * 60 * 60 * 1000);

  await db.setupLink.create({
    data: {
      token,
      restaurantId: restaurant.id,
      email,
      name: data.name ?? null,
      expiresAt,
      createdByOperatorId: operator.id,
    },
  });

  revalidatePath(`/app/clients/${data.slug}/handoff`);
  return {
    ok: true,
    url: `/setup/${token}`,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Revoke a setup link before it's used (e.g. operator regenerated, or
 * picked the wrong email).
 */
export async function revokeSetupLink(input: { linkId: string }) {
  const { linkId } = z.object({ linkId: z.string() }).parse(input);
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const link = await db.setupLink.findUnique({ where: { id: linkId } });
  if (!link || link.createdByOperatorId !== auth.operator.id) {
    return { ok: false as const, error: "Link not found" };
  }
  await db.setupLink.delete({ where: { id: linkId } });
  revalidatePath(`/app/clients`);
  return { ok: true as const };
}
