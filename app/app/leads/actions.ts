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
import { computeLeadCapacity, getTier, hasActiveAccess } from "@/lib/subscriptions";

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

export interface SearchDiagnostic {
  /** Exact text query we sent to Google. */
  queryUsed: string;
  /** Google primary_type we filtered on, if any. */
  typeFilterApplied: string | null;
  /** True if we dropped the strict type filter on a fallback retry. */
  fallbackTried: boolean;
  /** Raw count Google returned. */
  returned: number;
  /** How many we filtered out because they already have a website. */
  haveWebsite: number;
  /** Saved count (after dedupe + cap). */
  saved: number;
  /** Already in your list. */
  duplicates: number;
  /** How many we couldn't save because the operator was at their lead cap. */
  skippedDueToCap: number;
}

export interface SearchLeadsResult {
  ok: boolean;
  error?: string;
  searchId?: string;
  diagnostic?: SearchDiagnostic;
  capacity?: { used: number; cap: number; remaining: number };
  /** True when no leads were saved and a suggestion is useful (no website filter, etc.) */
  suggestLoosen?: boolean;
}

/**
 * Map operator-typed business categories to Google Places primary types.
 * Returns `undefined` when there's no obvious mapping — we then fall back
 * to pure text search.
 *
 * Full reference: https://developers.google.com/maps/documentation/places/web-service/place-types
 */
function mapToGooglePrimaryType(input: string): string | undefined {
  const t = input.toLowerCase().trim();
  const direct: Record<string, string> = {
    restaurant: "restaurant",
    restaurants: "restaurant",
    cafe: "cafe",
    coffee: "cafe",
    "coffee shop": "cafe",
    bar: "bar",
    pub: "bar",
    bakery: "bakery",
    pizza: "pizza_restaurant",
    "pizza shop": "pizza_restaurant",
    "fast food": "fast_food_restaurant",
    diner: "american_restaurant",
    salon: "hair_salon",
    "hair salon": "hair_salon",
    "nail salon": "nail_salon",
    barber: "barber_shop",
    barbershop: "barber_shop",
    spa: "spa",
    gym: "gym",
    fitness: "gym",
    dentist: "dental_clinic",
    dental: "dental_clinic",
    "law firm": "lawyer",
    lawyer: "lawyer",
    attorney: "lawyer",
    accountant: "accounting",
    accounting: "accounting",
    plumber: "plumber",
    plumbing: "plumber",
    electrician: "electrician",
    "auto repair": "car_repair",
    mechanic: "car_repair",
    landscaping: "landscaping_service",
    landscaper: "landscaping_service",
    "real estate": "real_estate_agency",
    realtor: "real_estate_agency",
    realestate: "real_estate_agency",
  };
  if (direct[t]) return direct[t];
  if (t.includes("restaurant")) return "restaurant";
  if (t.includes("cafe") || t.includes("coffee")) return "cafe";
  if (t.includes("salon")) return "hair_salon";
  return undefined;
}

/** Pull a human-readable message out of Google's error response body. */
function extractGoogleError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const e = (body as { error?: { message?: string; status?: string } }).error;
  if (!e) return null;
  if (e.message && e.status) return `${e.message} (${e.status})`;
  return e.message ?? e.status ?? null;
}

/**
 * Build the text query we send to Google. Avoids double-stuffing the
 * business type (e.g. user types "restaurants in Golden" + businessType
 * "restaurant" → just "restaurants in Golden").
 */
function buildTextQuery(query: string, businessType?: string): string {
  const q = query.trim();
  if (!businessType) return q;
  const bt = businessType.trim().toLowerCase();
  const ql = q.toLowerCase();
  // If the query already mentions the same business type word, don't double up.
  if (bt && (ql.includes(bt) || ql.includes(bt.replace(/s$/, "")))) return q;
  return `${businessType} in ${q}`;
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

  // Lead-inventory cap (replaces the old monthly-lookup cap). The operator's
  // tier sets the ceiling on how many leads they can have in their CRM at
  // once. Deleting old leads frees capacity. New searches save only up to
  // the remaining slots.
  const tier = getTier(operator.subscriptionTier);
  const currentLeadCount = await db.lead.count({
    where: { operatorId: operator.id },
  });
  const capacity = computeLeadCapacity(currentLeadCount, tier.maxLeads);

  if (capacity.remaining <= 0) {
    return {
      ok: false,
      error: `You're at your ${tier.name} plan cap of ${tier.maxLeads} leads. Delete some leads or upgrade in Billing to find more.`,
      capacity,
    };
  }

  if (!operator.googlePlacesApiKey) {
    return {
      ok: false,
      error: "Add your Google Places API key in Settings to enable lead searching.",
      capacity,
    };
  }

  const textQuery = buildTextQuery(query, businessType);
  const initialIncludedType = businessType
    ? mapToGooglePrimaryType(businessType)
    : undefined;

  // First attempt — strict (with type filter, if any)
  let places: PlaceResult[] = [];
  let fallbackTried = false;
  let typeFilterApplied: string | null = initialIncludedType ?? null;

  try {
    places = await searchPlaces({
      apiKey: operator.googlePlacesApiKey,
      textQuery,
      maxResults: 60,
      includedType: initialIncludedType,
    });
  } catch (e) {
    if (e instanceof PlacesError) {
      const detail = extractGoogleError(e.body);
      const prefix =
        e.status === 401 || e.status === 403
          ? "Google rejected the request"
          : `Google Places error (${e.status})`;
      console.error("[leads-search]", e.status, e.body);
      return {
        ok: false,
        error: detail ? `${prefix}: ${detail}` : `${prefix}. Check Settings.`,
        capacity,
      };
    }
    console.error("[leads-search]", e);
    return { ok: false, error: "Search failed. Please try again.", capacity };
  }

  // Fallback: if strict primary-type filter returned 0, retry without it.
  // The text query alone often still matches the right businesses, just
  // adjacent Places types we didn't have in our map.
  if (places.length === 0 && initialIncludedType) {
    fallbackTried = true;
    typeFilterApplied = null;
    try {
      places = await searchPlaces({
        apiKey: operator.googlePlacesApiKey,
        textQuery,
        maxResults: 60,
      });
    } catch (e) {
      console.error("[leads-search] fallback", e);
    }
  }

  const returned = places.length;
  const filtered = onlyNoWebsite ? filterNoWebsite(places) : places;
  const haveWebsite = returned - filtered.length;

  const search = await db.leadSearch.create({
    data: {
      operatorId: operator.id,
      query,
      businessType: businessType ?? null,
      resultCount: returned,
      savedCount: 0,
    },
  });

  // Save up to remaining capacity. Dedupe runs at the DB level via the
  // unique constraint (operatorId, googlePlaceId).
  let saved = 0;
  let duplicates = 0;
  let skippedDueToCap = 0;
  let remainingSlots = capacity.remaining;

  for (const p of filtered) {
    if (remainingSlots <= 0) {
      skippedDueToCap++;
      continue;
    }
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
      saved++;
      remainingSlots--;
    } catch (e) {
      if (
        e instanceof Error &&
        /Unique constraint failed|UNIQUE constraint failed/.test(e.message)
      ) {
        duplicates++;
      } else {
        console.error("[leads-search] insert failed", e);
        duplicates++;
      }
    }
  }

  await db.leadSearch.update({
    where: { id: search.id },
    data: { savedCount: saved },
  });

  revalidatePath("/app/leads");

  const newCapacity = computeLeadCapacity(currentLeadCount + saved, tier.maxLeads);
  const diagnostic: SearchDiagnostic = {
    queryUsed: textQuery,
    typeFilterApplied,
    fallbackTried,
    returned,
    haveWebsite,
    saved,
    duplicates,
    skippedDueToCap,
  };

  // "Loosen" suggestion: nothing saved AND we have capacity AND the filter
  // chain is the likely culprit (had results but no-website filter killed
  // them all, or no results at all).
  const suggestLoosen =
    saved === 0 &&
    skippedDueToCap === 0 &&
    (returned === 0 || haveWebsite === returned);

  return {
    ok: true,
    searchId: search.id,
    diagnostic,
    capacity: { used: newCapacity.used, cap: newCapacity.cap, remaining: newCapacity.remaining },
    suggestLoosen,
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

// ============================================================
// Bulk delete (used to free capacity when at cap)
// ============================================================

export async function deleteClosedLeads(input: { kind: "lost" | "won_lost" | "all_closed" }) {
  const { operator } = await ensureOperator();
  const { kind } = z
    .object({ kind: z.enum(["lost", "won_lost", "all_closed"]) })
    .parse(input);
  const statuses =
    kind === "lost"
      ? ["closed_lost"]
      : kind === "won_lost"
        ? ["closed_won", "closed_lost"]
        : ["closed_won", "closed_lost"];
  const res = await db.lead.deleteMany({
    where: { operatorId: operator.id, status: { in: statuses } },
  });
  revalidatePath("/app/leads");
  return { ok: true as const, deleted: res.count };
}
