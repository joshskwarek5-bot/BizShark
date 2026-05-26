"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import {
  filterNoWebsite,
  PlacesError,
  searchPlaces,
  type PlaceResult,
} from "@/lib/google-places";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/lead-status";
import { getTier, hasActiveAccess } from "@/lib/subscriptions";

async function ensureOperator() {
  const res = await requireOperator();
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

// ============================================================
// Search leads (Google Places + filter + save dedup'd)
// ============================================================

const SearchSchema = z.object({
  query: z.string().min(2).max(120),
  businessType: z.string().max(40).optional(),
  onlyNoWebsite: z.boolean().default(true),
});

export interface SearchLeadsResult {
  ok: boolean;
  error?: string;
  searchId?: string;
  totalReturned?: number;
  savedCount?: number;
  skippedCount?: number;
}

export async function searchLeadsAction(
  input: z.infer<typeof SearchSchema>
): Promise<SearchLeadsResult> {
  const { operator } = await ensureOperator();
  const parsed = SearchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { query, businessType, onlyNoWebsite } = parsed.data;

  if (!hasActiveAccess(operator)) {
    return {
      ok: false,
      error:
        "Your subscription is inactive. Re-subscribe from Billing to keep searching.",
    };
  }

  // Tier-based monthly limit
  const tier = getTier(operator.subscriptionTier);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const searchesThisMonth = await db.leadSearch.count({
    where: { operatorId: operator.id, createdAt: { gte: startOfMonth } },
  });
  if (searchesThisMonth >= tier.leadLookupsPerMonth) {
    return {
      ok: false,
      error: `You've used all ${tier.leadLookupsPerMonth} lead lookups for this month on the ${tier.name} plan. Upgrade in Billing for more.`,
    };
  }

  if (!operator.googlePlacesApiKey) {
    return {
      ok: false,
      error:
        "Add your Google Places API key in Settings to enable lead searching.",
    };
  }

  // Compose the text query — bias toward business type if provided
  const textQuery = businessType ? `${businessType} in ${query}` : query;

  let places: PlaceResult[];
  try {
    places = await searchPlaces({
      apiKey: operator.googlePlacesApiKey,
      textQuery,
      maxResults: 20,
    });
  } catch (e) {
    if (e instanceof PlacesError) {
      const msg =
        e.status === 401 || e.status === 403
          ? "Google Places rejected the API key — double-check it in Settings."
          : `Google Places error: ${e.message}`;
      return { ok: false, error: msg };
    }
    console.error("[leads-search]", e);
    return { ok: false, error: "Search failed. Please try again." };
  }

  const totalReturned = places.length;
  const filtered = onlyNoWebsite ? filterNoWebsite(places) : places;

  // Record the search
  const search = await db.leadSearch.create({
    data: {
      operatorId: operator.id,
      query,
      businessType: businessType ?? null,
      resultCount: totalReturned,
      savedCount: 0,
    },
  });

  // Save each as a Lead, deduped by (operatorId, googlePlaceId).
  let savedCount = 0;
  let skippedCount = 0;
  for (const p of filtered) {
    try {
      await db.lead.create({
        data: {
          operatorId: operator.id,
          searchId: search.id,
          googlePlaceId: p.placeId,
          businessName: p.name,
          businessType: p.primaryType,
          address: p.address,
          city: p.city,
          state: p.state,
          zip: p.zip,
          phone: p.phone,
          websiteUrl: p.websiteUri,
          rating: p.rating,
          reviewCount: p.reviewCount,
          photoUrl: null,
          lat: p.lat,
          lng: p.lng,
          status: "new",
        },
      });
      savedCount++;
    } catch (e) {
      // Unique constraint (operatorId, googlePlaceId) → already saved
      if (
        e instanceof Error &&
        /Unique constraint failed|UNIQUE constraint failed/.test(e.message)
      ) {
        skippedCount++;
      } else {
        console.error("[leads-search] insert failed", e);
        skippedCount++;
      }
    }
  }

  await db.leadSearch.update({
    where: { id: search.id },
    data: { savedCount },
  });

  revalidatePath("/app/leads");
  return {
    ok: true,
    searchId: search.id,
    totalReturned,
    savedCount,
    skippedCount,
  };
}

// ============================================================
// Lead status + notes
// ============================================================

const UpdateStatusSchema = z.object({
  id: z.string(),
  status: z.enum(LEAD_STATUSES),
});

export async function updateLeadStatus(input: z.infer<typeof UpdateStatusSchema>) {
  const { operator } = await ensureOperator();
  const { id, status } = UpdateStatusSchema.parse(input);
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || lead.operatorId !== operator.id) {
    return { ok: false as const, error: "Lead not found" };
  }
  const data: { status: LeadStatus; lastContactedAt?: Date } = { status };
  // Bump lastContactedAt when moving into the contacted column
  if (status === "contacted" && lead.status !== "contacted") {
    data.lastContactedAt = new Date();
  }
  await db.lead.update({ where: { id }, data });
  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${id}`);
  return { ok: true as const };
}

const UpdateNotesSchema = z.object({
  id: z.string(),
  notes: z.string().max(4000).nullable(),
});

export async function updateLeadNotes(input: z.infer<typeof UpdateNotesSchema>) {
  const { operator } = await ensureOperator();
  const { id, notes } = UpdateNotesSchema.parse(input);
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || lead.operatorId !== operator.id) {
    return { ok: false as const, error: "Lead not found" };
  }
  await db.lead.update({ where: { id }, data: { notes: notes?.trim() || null } });
  revalidatePath(`/app/leads/${id}`);
  return { ok: true as const };
}

export async function deleteLead(input: { id: string }) {
  const { operator } = await ensureOperator();
  const { id } = z.object({ id: z.string() }).parse(input);
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || lead.operatorId !== operator.id) {
    return { ok: false as const, error: "Lead not found" };
  }
  await db.lead.delete({ where: { id } });
  revalidatePath("/app/leads");
  return { ok: true as const };
}
