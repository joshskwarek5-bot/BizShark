"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireOperator } from "@/lib/auth";
import { getTier, hasActiveAccess } from "@/lib/subscriptions";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_META,
  type BusinessType,
} from "@/lib/business-types";
import { normalizeFeatures, serializeFeatures, FEATURE_KEYS } from "@/lib/features";
import {
  ingestScrapedPhotoAsAsset,
  ingestScrapedPhotos,
} from "@/lib/scraped-photos";

async function ensureOperator() {
  const res = await requireOperator();
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

const CreateClientSchema = z.object({
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
  // Admin credentials are OPTIONAL for operator-created clients — the
  // operator can manage the site themselves and hand off later.
  adminEmail: z.string().email().max(120).optional().or(z.literal("")),
  adminName: z.string().max(120).optional(),
  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(120)
    .optional()
    .or(z.literal("")),
  // Optional — if present, this lead is auto-converted on success
  leadId: z.string().optional(),
  // Optional — URLs from the auto-scrape; fetched + saved as restaurant assets
  // after the row is created.
  scrapedHeroPhotoUrl: z.string().url().optional().nullable(),
  scrapedGalleryUrls: z.array(z.string().url()).max(20).optional(),
  // When true, the server skips the text-only AI hero fallback because the
  // client will run reference-based generation immediately after create.
  skipAiHero: z.boolean().optional(),
});

export type CreateClientInput = z.input<typeof CreateClientSchema>;

export async function createClientAsOperator(input: CreateClientInput) {
  const { operator } = await ensureOperator();
  const parsed = CreateClientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please fix the errors and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  if (!hasActiveAccess(operator)) {
    return {
      ok: false as const,
      error:
        "Your subscription is inactive. Re-subscribe from Billing to add new clients.",
    };
  }

  // Tier-based client cap
  const tier = getTier(operator.subscriptionTier);
  if (tier.maxClients !== null) {
    const currentClients = await db.restaurant.count({
      where: { operatorId: operator.id },
    });
    if (currentClients >= tier.maxClients) {
      return {
        ok: false as const,
        error: `Your ${tier.name} plan allows up to ${tier.maxClients} client${tier.maxClients === 1 ? "" : "s"}. Upgrade in Billing to add more.`,
      };
    }
  }

  const slugExists = await db.restaurant.findUnique({ where: { slug: data.slug } });
  if (slugExists)
    return { ok: false as const, error: `Slug "${data.slug}" is already taken.` };

  const adminEmail = data.adminEmail?.toLowerCase().trim();
  if (adminEmail) {
    const adminExists = await db.user.findUnique({ where: { email: adminEmail } });
    if (adminExists)
      return {
        ok: false as const,
        error: `A user with email ${adminEmail} already exists.`,
      };
    if (!data.adminPassword || data.adminPassword.length < 8) {
      return {
        ok: false as const,
        error: "Admin password must be at least 8 characters if you set an admin email.",
        fieldErrors: { adminPassword: ["Required when admin email is set"] } as Record<
          string,
          string[]
        >,
      };
    }
  }

  const defaultHours = JSON.stringify({
    mon: { open: "09:00", close: "17:00" },
    tue: { open: "09:00", close: "17:00" },
    wed: { open: "09:00", close: "17:00" },
    thu: { open: "09:00", close: "17:00" },
    fri: { open: "09:00", close: "17:00" },
    sat: { open: "09:00", close: "17:00" },
    sun: { open: "09:00", close: "17:00", closed: true },
  });

  // If a leadId is provided, verify ownership BEFORE creating anything so a
  // stale URL param doesn't trigger a half-converted state. Silent ignore if
  // the lead doesn't exist or belongs to another operator.
  let validLead: { id: string } | null = null;
  if (data.leadId) {
    const lead = await db.lead.findUnique({ where: { id: data.leadId } });
    if (lead && lead.operatorId === operator.id) {
      validLead = { id: lead.id };
    }
  }

  // Resolve enabled features: caller list (if provided) → normalize against
  // type rules → fall back to type defaults.
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
        operatorId: operator.id,
      },
    });
    if (adminEmail && data.adminPassword) {
      await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash: await hashPassword(data.adminPassword),
          name: data.adminName ?? null,
          role: "restaurant_admin",
          restaurantId: r.id,
        },
      });
    }
    if (validLead) {
      await tx.lead.update({
        where: { id: validLead.id },
        data: { status: "qualified", convertedRestaurantId: r.id },
      });
    }
    return r;
  });

  // Ingest scraped photos AFTER the row exists so the upload pipeline can
  // file them under restaurants/<slug>/.... Failures here are non-fatal —
  // the operator can re-upload manually from Settings.
  let heroImageUrl: string | null = null;
  if (data.scrapedHeroPhotoUrl) {
    try {
      const heroUrl = await ingestScrapedPhotoAsAsset(
        restaurant.slug,
        data.scrapedHeroPhotoUrl,
        "hero"
      );
      if (heroUrl) {
        await db.restaurant.update({
          where: { id: restaurant.id },
          data: { heroImageUrl: heroUrl },
        });
        heroImageUrl = heroUrl;
      }
    } catch (e) {
      console.warn("[createClientAsOperator] hero photo ingest failed:", e);
    }
  }
  if (data.scrapedGalleryUrls && data.scrapedGalleryUrls.length > 0) {
    try {
      // Skip the hero so it doesn't get double-saved
      const gallery = data.scrapedGalleryUrls.filter(
        (u) => u !== data.scrapedHeroPhotoUrl
      );
      if (gallery.length > 0) {
        await ingestScrapedPhotos(restaurant.slug, gallery, "items", 12);
        // Gallery model lands in Phase B; for now these are uploaded but not
        // yet referenced from a Gallery row. They live in storage ready to
        // be wired up.
      }
    } catch (e) {
      console.warn("[createClientAsOperator] gallery photos ingest failed:", e);
    }
  }

  // ---- AI hero fallback ----
  // If nothing landed in heroImageUrl and the operator has an OpenAI key on
  // file, fire a text-to-image generation so every new client opens with a
  // polished hero instead of the empty-state placeholder. Wrapped tightly
  // so a 30s OpenAI failure never breaks the create flow.
  // Skipped when the caller is about to run reference-based generation
  // post-create — otherwise we'd burn an OpenAI call and instantly throw
  // away the result.
  let aiHeroGenerated = false;
  if (!heroImageUrl && !data.skipAiHero && operator.openaiApiKey) {
    try {
      const { enhanceImage } = await import("@/lib/ai-image");
      const { uploadImage } = await import("@/lib/upload");
      const subject = `${restaurant.name}${restaurant.city ? ` in ${restaurant.city}` : ""}`;
      const result = await enhanceImage({
        apiKey: operator.openaiApiKey,
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
      console.warn("[createClientAsOperator] AI hero gen failed:", e);
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/clients");
  if (validLead) {
    revalidatePath(`/app/leads/${validLead.id}`);
    revalidatePath("/app/leads");
  }
  revalidatePath("/platform");
  revalidatePath("/platform/restaurants");
  return { ok: true as const, restaurant, aiHeroGenerated };
}
