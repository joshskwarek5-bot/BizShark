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
  // Common multi-word fallbacks
  if (t.includes("restaurant")) return "restaurant";
  if (t.includes("cafe") || t.includes("coffee")) return "cafe";
  if (t.includes("salon")) return "hair_salon";
  // HVAC has no first-class Google primary type — leave to text search.
  return undefined;
}

/** Pull a human-readable message out of Google's error response body. */
function extractGoogleError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  // Standard Google API error shape:
  //   { error: { code, message, status, details: [...] } }
  const e = (body as { error?: { message?: string; status?: string } }).error;
  if (!e) return null;
  if (e.message && e.status) return `${e.message} (${e.status})`;
  return e.message ?? e.status ?? null;
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
  // Strict primary-type filter when the operator picked a recognizable
  // category. Materially better than relying on text alone (Google's text
  // ranker happily returns adjacent types — search "restaurant in X" and
  // you'll get bars, food trucks, grocery, etc.).
  const includedType = businessType
    ? mapToGooglePrimaryType(businessType)
    : undefined;

  let places: PlaceResult[];
  try {
    places = await searchPlaces({
      apiKey: operator.googlePlacesApiKey,
      textQuery,
      maxResults: 60,
      includedType,
    });
  } catch (e) {
    if (e instanceof PlacesError) {
      // Pull Google's actual error message if present — much more useful than
      // a generic "rejected" when diagnosing key/billing/API-enablement.
      const detail = extractGoogleError(e.body);
      const prefix =
        e.status === 401 || e.status === 403
          ? "Google rejected the request"
          : `Google Places error (${e.status})`;
      console.error("[leads-search]", e.status, e.body);
      return {
        ok: false,
        error: detail ? `${prefix}: ${detail}` : `${prefix}. Check Settings.`,
      };
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
