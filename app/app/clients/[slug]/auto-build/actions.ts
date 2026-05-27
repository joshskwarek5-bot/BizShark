"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { getTier, hasActiveAccess } from "@/lib/subscriptions";
import { scrapeMultipleSites } from "@/lib/multi-scrape";
import { autoPopulateRestaurant, type PopulateResult } from "@/lib/auto-populate";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";

const InputSchema = z.object({
  slug: z.string(),
  urls: z.array(z.string().min(4).max(500)).min(1).max(5),
  setHeroIfMissing: z.boolean().default(true),
});

export interface AutoBuildSuccess {
  ok: true;
  summary: PopulateResult;
  perSource: Awaited<ReturnType<typeof scrapeMultipleSites>>["perSource"];
  totalUrls: number;
  successfulScrapes: number;
}

export interface AutoBuildFailure {
  ok: false;
  error: string;
}

export type AutoBuildResult = AutoBuildSuccess | AutoBuildFailure;

/**
 * One-click "Auto-build everything from these URLs":
 *  1) Scrapes 1-5 URLs in parallel
 *  2) Merges into a single ExtractedSite
 *  3) Populates Staff/Testimonials/FAQs/Gallery/Menu/Services rows
 *  4) Optionally sets a hero image from the best photo found
 *
 * Pro-gated. Never overwrites operator-edited fields; only fills blanks.
 */
export async function autoBuildClient(
  input: z.infer<typeof InputSchema>
): Promise<AutoBuildResult> {
  const auth = await requireOperator();
  if (!auth.authorized) return { ok: false, error: "Not authorized" };
  if (!hasActiveAccess(auth.operator)) {
    return {
      ok: false,
      error: "Subscription inactive. Re-subscribe from Billing to use Auto-build.",
    };
  }
  const tier = getTier(auth.operator.subscriptionTier);
  if (tier.id === "starter") {
    return {
      ok: false,
      error:
        "Auto-build is a Pro feature. Upgrade in Billing to unlock multi-source AI population.",
    };
  }

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const restaurant = await db.restaurant.findUnique({ where: { slug: data.slug } });
  if (!restaurant) return { ok: false, error: "Restaurant not found" };
  if (restaurant.operatorId !== auth.operator.id) {
    return { ok: false, error: "Forbidden" };
  }

  const businessType: BusinessType = (
    BUSINESS_TYPES as readonly string[]
  ).includes(restaurant.type)
    ? (restaurant.type as BusinessType)
    : "restaurant";

  // Stage 1: multi-scrape
  let multi: Awaited<ReturnType<typeof scrapeMultipleSites>>;
  try {
    multi = await scrapeMultipleSites({
      urls: data.urls,
      knownBusinessName: restaurant.name,
      knownBusinessType: restaurant.type,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "All scrapes failed",
    };
  }
  const successfulScrapes = multi.perSource.filter((s) => s.ok).length;

  // Stage 2: auto-populate
  let summary: PopulateResult;
  try {
    summary = await autoPopulateRestaurant({
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      site: multi.merged,
      businessType,
      opts: { setHeroIfMissing: data.setHeroIfMissing },
    });
  } catch (e) {
    console.error("[autoBuildClient] populate failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Auto-populate failed",
    };
  }

  // Reflect everything that may have changed
  revalidatePath(`/app/clients/${data.slug}`);
  revalidatePath(`/r/${data.slug}`);
  revalidatePath(`/r/${data.slug}/admin`);
  revalidatePath(`/r/${data.slug}/admin/team`);
  revalidatePath(`/r/${data.slug}/admin/gallery`);
  revalidatePath(`/r/${data.slug}/admin/classes`);
  revalidatePath(`/r/${data.slug}/admin/menu`);
  revalidatePath(`/r/${data.slug}/admin/settings`);

  return {
    ok: true,
    summary,
    perSource: multi.perSource,
    totalUrls: data.urls.length,
    successfulScrapes,
  };
}
