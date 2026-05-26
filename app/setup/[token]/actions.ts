"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";

export interface CompleteSetupState {
  ok: boolean;
  error?: string;
}

const Schema = z.object({
  token: z.string().min(8),
  password: z.string().min(8, "Password must be at least 8 characters").max(120),
  name: z.string().max(120).optional(),
});

/**
 * Called from the public /setup/<token> form. Verifies the token, creates
 * (or attaches to) a restaurant_admin User, marks the link used, signs the
 * user in, and redirects to their restaurant admin.
 */
export async function completeSetup(
  _prev: CompleteSetupState,
  formData: FormData
): Promise<CompleteSetupState> {
  const parsed = Schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { token, password, name } = parsed.data;

  const link = await db.setupLink.findUnique({
    where: { token },
    include: { restaurant: { select: { id: true, slug: true, name: true } } },
  });
  if (!link) return { ok: false, error: "Invalid or expired setup link." };
  if (link.usedAt) return { ok: false, error: "This link has already been used." };
  if (link.expiresAt < new Date())
    return { ok: false, error: "This link has expired. Ask your provider for a new one." };

  // Double-check no User has snuck in with this email since the link was
  // minted (e.g. operator created the admin via the legacy form path).
  const existing = await db.user.findUnique({ where: { email: link.email } });
  if (existing) {
    return {
      ok: false,
      error: `An account with ${link.email} already exists. Try signing in at /login.`,
    };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: link.email,
        passwordHash,
        name: name ?? link.name ?? null,
        role: "restaurant_admin",
        restaurantId: link.restaurantId,
      },
    });
    await tx.setupLink.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    });
    return u;
  });

  // Auto-login
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.role = "restaurant_admin";
  session.restaurantId = link.restaurantId;
  session.operatorId = null;
  await session.save();

  redirect(`/r/${link.restaurant.slug}/admin?welcome=1`);
}
