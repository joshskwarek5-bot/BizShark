"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, logoutUser, requireSuperAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_META,
  type BusinessType,
} from "@/lib/business-types";
import { FEATURE_KEYS, normalizeFeatures, serializeFeatures } from "@/lib/features";

async function ensureSuper() {
  const res = await requireSuperAdmin();
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

const CreateRestaurantSchema = z.object({
  type: z.enum(BUSINESS_TYPES).default("restaurant"),
  templateId: z.string().default("modern"),
  enabledFeatures: z.array(z.enum(FEATURE_KEYS)).optional(),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  tagline: z.string().max(180).optional().nullable(),
  heroHeadline: z.string().max(180).optional().nullable(),
  heroSubhead: z.string().max(280).optional().nullable(),
  aboutCopy: z.string().max(2000).optional().nullable(),
  address: z.string().min(1).max(200),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  phone: z.string().min(1).max(40),
  email: z.string().email().max(120).optional().or(z.literal("")).nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  taxBps: z.number().int().min(0).max(2000),
  servicesJson: z.string().optional().nullable(),
  adminEmail: z.string().email().max(120),
  adminName: z.string().max(120).optional(),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateRestaurantInput = z.input<typeof CreateRestaurantSchema>;

export async function createRestaurant(input: CreateRestaurantInput) {
  await ensureSuper();
  const parsed = CreateRestaurantSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please fix the errors and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const slugExists = await db.restaurant.findUnique({ where: { slug: data.slug } });
  if (slugExists) return { ok: false as const, error: `Slug "${data.slug}" is already taken.` };

  const adminExists = await db.user.findUnique({
    where: { email: data.adminEmail.toLowerCase().trim() },
  });
  if (adminExists)
    return {
      ok: false as const,
      error: `A user with email ${data.adminEmail} already exists.`,
    };

  const defaultHours = JSON.stringify({
    mon: { open: "09:00", close: "17:00" },
    tue: { open: "09:00", close: "17:00" },
    wed: { open: "09:00", close: "17:00" },
    thu: { open: "09:00", close: "17:00" },
    fri: { open: "09:00", close: "17:00" },
    sat: { open: "09:00", close: "17:00" },
    sun: { open: "09:00", close: "17:00", closed: true },
  });

  const typeMeta = BUSINESS_TYPE_META[data.type as BusinessType];
  const rawFeatures = data.enabledFeatures ?? typeMeta.defaultFeatures;
  const features = normalizeFeatures(data.type as BusinessType, rawFeatures);

  const restaurant = await db.$transaction(async (tx) => {
    const r = await tx.restaurant.create({
      data: {
        slug: data.slug,
        name: data.name,
        type: data.type,
        templateId: data.templateId,
        enabledFeatures: serializeFeatures(features),
        tagline: data.tagline ?? null,
        heroHeadline: data.heroHeadline ?? null,
        heroSubhead: data.heroSubhead ?? null,
        aboutCopy: data.aboutCopy ?? null,
        services: data.servicesJson ?? null,
        address: data.address,
        city: data.city ?? null,
        state: data.state ?? null,
        zip: data.zip ?? null,
        phone: data.phone,
        email: data.email || null,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        taxBps: typeMeta.hasMenu ? data.taxBps : 0,
        hours: defaultHours,
        isActive: true,
        isPrimary: false,
      },
    });
    await tx.user.create({
      data: {
        email: data.adminEmail.toLowerCase().trim(),
        passwordHash: await hashPassword(data.adminPassword),
        name: data.adminName ?? null,
        role: "restaurant_admin",
        restaurantId: r.id,
      },
    });
    return r;
  });

  // ---- AI hero fallback ----
  // Platform-created restaurants normally have no owning operator, but when
  // one is assigned (and has an OpenAI key on file) we generate a hero so
  // the new landing page isn't an empty placeholder. Failures are swallowed.
  let aiHeroGenerated = false;
  if (restaurant.operatorId) {
    const op = await db.operator.findUnique({
      where: { id: restaurant.operatorId },
      select: { openaiApiKey: true },
    });
    if (op?.openaiApiKey) {
      try {
        const { enhanceImage } = await import("@/lib/ai-image");
        const { uploadImage } = await import("@/lib/upload");
        const subject = `${restaurant.name}${restaurant.city ? ` in ${restaurant.city}` : ""}`;
        const result = await enhanceImage({
          apiKey: op.openaiApiKey,
          kind: "hero",
          subject,
        });
        const url = await uploadImage(restaurant.slug, result.file, "hero");
        await db.restaurant.update({
          where: { id: restaurant.id },
          data: { heroImageUrl: url },
        });
        aiHeroGenerated = true;
      } catch (e) {
        console.warn("[createRestaurant] AI hero gen failed:", e);
      }
    }
  }

  revalidatePath("/platform");
  revalidatePath("/platform/restaurants");
  revalidatePath("/");
  return { ok: true as const, restaurant, aiHeroGenerated };
}

export async function toggleRestaurantActive(input: { id: string; isActive: boolean }) {
  await ensureSuper();
  const { id, isActive } = z.object({ id: z.string(), isActive: z.boolean() }).parse(input);
  await db.restaurant.update({ where: { id }, data: { isActive } });
  revalidatePath("/platform");
  revalidatePath("/platform/restaurants");
  return { ok: true as const };
}

export async function setPrimaryRestaurant(input: { id: string }) {
  await ensureSuper();
  const { id } = z.object({ id: z.string() }).parse(input);
  await db.$transaction([
    db.restaurant.updateMany({ data: { isPrimary: false } }),
    db.restaurant.update({ where: { id }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/platform");
  revalidatePath("/platform/restaurants");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteRestaurant(input: { id: string; confirmName: string }) {
  await ensureSuper();
  const { id, confirmName } = z
    .object({ id: z.string(), confirmName: z.string() })
    .parse(input);
  const r = await db.restaurant.findUnique({ where: { id } });
  if (!r) return { ok: false as const, error: "Restaurant not found" };
  if (r.name !== confirmName) {
    return { ok: false as const, error: "Confirmation name did not match." };
  }
  await db.restaurant.delete({ where: { id } });
  revalidatePath("/platform");
  revalidatePath("/platform/restaurants");
  return { ok: true as const };
}

export async function suggestSlug(name: string): Promise<string> {
  return slugify(name);
}

export async function platformLogoutAction() {
  await logoutUser();
  redirect("/platform/login");
}
