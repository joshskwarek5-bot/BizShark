"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { getTier, hasActiveAccess } from "@/lib/subscriptions";
import {
  ingestScrapedPhotoAsAsset,
  ingestScrapedPhotos,
} from "@/lib/scraped-photos";

async function ensureOwnedRestaurant(slug: string) {
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const r = await db.restaurant.findUnique({ where: { slug } });
  if (!r) throw new Error("not_found");
  if (r.operatorId !== auth.operator.id) throw new Error("forbidden");
  return { operator: auth.operator, restaurant: r };
}

// ============================================================================
// Enrich existing restaurant from a scraped site
// ============================================================================

const EnrichSchema = z.object({
  slug: z.string(),
  fields: z
    .object({
      tagline: z.string().max(180).optional().nullable(),
      heroHeadline: z.string().max(180).optional().nullable(),
      heroSubhead: z.string().max(280).optional().nullable(),
      aboutCopy: z.string().max(2000).optional().nullable(),
      address: z.string().max(200).optional().nullable(),
      city: z.string().max(80).optional().nullable(),
      state: z.string().max(40).optional().nullable(),
      zip: z.string().max(20).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      email: z.string().email().max(120).optional().or(z.literal("")).nullable(),
    })
    .partial(),
  /** Operator-picked hero replacement (downloaded + saved if present). */
  heroPhotoUrl: z.string().url().optional().nullable(),
  /** Operator-picked gallery additions. */
  galleryPhotoUrls: z.array(z.string().url()).max(20).optional(),
});

export type EnrichInput = z.infer<typeof EnrichSchema>;

export interface EnrichResult {
  ok: true;
  fieldsUpdated: string[];
  heroReplaced: boolean;
  galleryAdded: number;
}

/**
 * Merge selected scraped fields + photos into an existing restaurant. Only
 * updates fields that are passed in (caller has already done the per-field
 * "yes/no" picker). Pro-tier gated to match the scrape action itself.
 */
export async function enrichRestaurantFromScrape(
  input: EnrichInput
): Promise<EnrichResult | { ok: false; error: string }> {
  let context;
  try {
    context = await ensureOwnedRestaurant(input.slug);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized" };
  }
  const { operator, restaurant } = context;
  if (!hasActiveAccess(operator)) {
    return {
      ok: false,
      error: "Subscription inactive. Re-subscribe to use Enrich.",
    };
  }
  const tier = getTier(operator.subscriptionTier);
  if (tier.id === "starter") {
    return {
      ok: false,
      error: "Enrich is a Pro feature. Upgrade in Billing to unlock.",
    };
  }

  const data = EnrichSchema.parse(input);

  // Build update payload — only include fields the caller explicitly sent
  const updates: Record<string, string | null> = {};
  const fieldKeys: (keyof typeof data.fields)[] = [
    "tagline",
    "heroHeadline",
    "heroSubhead",
    "aboutCopy",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "email",
  ];
  const fieldsUpdated: string[] = [];
  for (const k of fieldKeys) {
    const v = data.fields[k];
    if (v === undefined) continue;
    // Treat empty string as "clear" — caller probably wants to NOT-merge,
    // so skip rather than wipe existing data.
    if (v === null || v === "") continue;
    updates[k] = v;
    fieldsUpdated.push(k);
  }

  if (Object.keys(updates).length > 0) {
    await db.restaurant.update({ where: { id: restaurant.id }, data: updates });
  }

  // Hero photo replace
  let heroReplaced = false;
  if (data.heroPhotoUrl) {
    try {
      const newUrl = await ingestScrapedPhotoAsAsset(
        restaurant.slug,
        data.heroPhotoUrl,
        "hero"
      );
      if (newUrl) {
        await db.restaurant.update({
          where: { id: restaurant.id },
          data: { heroImageUrl: newUrl },
        });
        heroReplaced = true;
      }
    } catch (e) {
      console.warn("[enrich] hero ingest failed:", e);
    }
  }

  // Gallery additions (currently uploaded into items/ folder; Gallery model lands in Phase B)
  let galleryAdded = 0;
  if (data.galleryPhotoUrls && data.galleryPhotoUrls.length > 0) {
    try {
      const skip = data.heroPhotoUrl ?? "";
      const gallery = data.galleryPhotoUrls.filter((u) => u !== skip);
      const stored = await ingestScrapedPhotos(restaurant.slug, gallery, "items", 12);
      galleryAdded = stored.length;
    } catch (e) {
      console.warn("[enrich] gallery ingest failed:", e);
    }
  }

  revalidatePath(`/app/clients/${data.slug}`);
  revalidatePath(`/r/${data.slug}`);
  revalidatePath(`/r/${data.slug}/admin/settings`);
  return {
    ok: true,
    fieldsUpdated,
    heroReplaced,
    galleryAdded,
  };
}
