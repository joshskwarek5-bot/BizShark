"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/auth";
import { getTier, hasActiveAccess } from "@/lib/subscriptions";
import {
  scrapeBusinessSite,
  ScrapeError,
  type ExtractedSite,
} from "@/lib/auto-scrape";

const ScrapeInputSchema = z.object({
  url: z.string().min(4).max(500),
  knownBusinessName: z.string().max(200).optional(),
  knownBusinessType: z.string().max(40).optional(),
});

export type ScrapeResult =
  | { ok: true; site: ExtractedSite }
  | { ok: false; error: string };

/**
 * Operator-facing wrapper around scrapeBusinessSite. Adds:
 *  - auth gate
 *  - tier gating (auto-scrape is Pro+ at the moment)
 *  - error normalization
 *
 * Use this from the new-client form OR from a lead detail page.
 */
export async function scrapeBusinessSiteAction(
  input: z.infer<typeof ScrapeInputSchema>
): Promise<ScrapeResult> {
  const auth = await requireOperator();
  if (!auth.authorized) return { ok: false, error: "Not authorized" };
  if (!hasActiveAccess(auth.operator)) {
    return {
      ok: false,
      error: "Subscription inactive. Re-subscribe from Billing to use Auto-scrape.",
    };
  }
  // Tier gating: starters get a nudge; pro+ get full access.
  const tier = getTier(auth.operator.subscriptionTier);
  if (tier.id === "starter") {
    return {
      ok: false,
      error:
        "Auto-scrape is a Pro feature. Upgrade in Billing to unlock one-click site building.",
    };
  }
  const parsed = ScrapeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const site = await scrapeBusinessSite({
      url: parsed.data.url,
      knownBusinessName: parsed.data.knownBusinessName,
      knownBusinessType: parsed.data.knownBusinessType,
    });
    return { ok: true, site };
  } catch (e) {
    console.error("[scrape]", e);
    if (e instanceof ScrapeError) {
      return { ok: false, error: e.message };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Scrape failed",
    };
  }
}

/**
 * Trial variant: lets the new-client form preview the scrape without using
 * the operator's tier slot. Returns a thin summary only. (Stub — wire to a
 * lower-cost call if we add a true sandbox tier.)
 */
export async function scrapeBusinessSitePreview(
  input: z.infer<typeof ScrapeInputSchema>
): Promise<ScrapeResult> {
  return scrapeBusinessSiteAction(input);
}
