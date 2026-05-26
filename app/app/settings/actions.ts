"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";

async function ensureOperator() {
  const res = await requireOperator();
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(120),
  businessName: z.string().max(120).optional().or(z.literal("")),
  areaCity: z.string().max(80).optional().or(z.literal("")),
  areaState: z.string().max(40).optional().or(z.literal("")),
});

export async function updateOperatorProfile(input: z.infer<typeof UpdateProfileSchema>) {
  const { operator } = await ensureOperator();
  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  await db.operator.update({
    where: { id: operator.id },
    data: {
      name: data.name,
      businessName: data.businessName?.trim() || null,
      areaCity: data.areaCity?.trim() || null,
      areaState: data.areaState?.trim() || null,
    },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true as const };
}

const ApiKeySchema = z.object({
  // Allow empty string to clear the key
  apiKey: z.string().max(200),
});

export async function updateGooglePlacesKey(input: z.infer<typeof ApiKeySchema>) {
  const { operator } = await ensureOperator();
  const { apiKey } = ApiKeySchema.parse(input);
  await db.operator.update({
    where: { id: operator.id },
    data: { googlePlacesApiKey: apiKey.trim() || null },
  });
  revalidatePath("/app/settings");
  return { ok: true as const, hasKey: Boolean(apiKey.trim()) };
}

const StripeKeySchema = z.object({
  secretKey: z.string().max(200),
});

export async function updateOperatorStripeKey(input: z.infer<typeof StripeKeySchema>) {
  const { operator } = await ensureOperator();
  const { secretKey } = StripeKeySchema.parse(input);
  const trimmed = secretKey.trim();
  if (trimmed && !/^sk_(test|live)_/.test(trimmed)) {
    return {
      ok: false as const,
      error:
        "That doesn't look like a Stripe secret key (should start with sk_test_ or sk_live_).",
    };
  }
  await db.operator.update({
    where: { id: operator.id },
    data: { stripeSecretKey: trimmed || null },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app/clients");
  return { ok: true as const, hasKey: Boolean(trimmed) };
}
