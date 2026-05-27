// Multi-URL scrape orchestrator. Runs scrapeBusinessSite against several
// public URLs in parallel (website + Facebook + Yelp + Instagram + …)
// and merges the results into one ExtractedSite with the best signal
// from each source.
//
// Merge strategy:
//   - text fields (tagline, about, address, phone, email): prefer the
//     LONGEST non-empty value across sources (longer = more info)
//   - arrays (services, menu, staff, testimonials, faqs): concat then
//     dedupe by case-insensitive name/quote/question
//   - photos: union, dedupe by URL, cap at 60
//   - schemaOrg: concat all blocks
//   - hours: prefer the first non-null
//   - socialLinks: union (later wins for any given platform)

import {
  scrapeBusinessSite,
  ScrapeError,
  type ExtractedSite,
} from "./auto-scrape";

const MAX_URLS = 5;
const MAX_PHOTOS_MERGED = 60;

export interface MultiScrapeOptions {
  urls: string[];
  apiKey?: string;
  knownBusinessName?: string;
  knownBusinessType?: string;
}

export interface MultiScrapeResult {
  merged: ExtractedSite;
  perSource: Array<{
    url: string;
    ok: boolean;
    error?: string;
    bytes?: number;
    counts?: {
      services: number;
      menuItems: number;
      staff: number;
      testimonials: number;
      photos: number;
    };
  }>;
}

export async function scrapeMultipleSites(
  opts: MultiScrapeOptions
): Promise<MultiScrapeResult> {
  const urls = Array.from(new Set(opts.urls.filter((u) => u && u.trim()))).slice(
    0,
    MAX_URLS
  );
  if (urls.length === 0) {
    throw new Error("At least one URL is required");
  }

  // Run all scrapes in parallel. Each one can take 15-45s; running serially
  // would be brutal. We tolerate per-URL failures.
  const results = await Promise.allSettled(
    urls.map((u) =>
      scrapeBusinessSite({
        url: u,
        apiKey: opts.apiKey,
        knownBusinessName: opts.knownBusinessName,
        knownBusinessType: opts.knownBusinessType,
      })
    )
  );

  const sites: ExtractedSite[] = [];
  const perSource: MultiScrapeResult["perSource"] = [];

  for (let i = 0; i < urls.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      sites.push(r.value);
      const s = r.value;
      perSource.push({
        url: urls[i],
        ok: true,
        bytes: s.htmlBytes,
        counts: {
          services: s.services?.length ?? 0,
          menuItems:
            s.menuCategories?.reduce((sum, c) => sum + c.items.length, 0) ?? 0,
          staff: s.staff?.length ?? 0,
          testimonials: s.testimonials?.length ?? 0,
          photos: s.photos.length,
        },
      });
    } else {
      const err = r.reason;
      perSource.push({
        url: urls[i],
        ok: false,
        error:
          err instanceof ScrapeError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error",
      });
    }
  }

  if (sites.length === 0) {
    throw new Error(
      "All scrapes failed: " +
        perSource
          .map((s) => `${shortenUrl(s.url)} (${s.error ?? "unknown"})`)
          .join("; ")
    );
  }

  return { merged: mergeSites(sites, urls[0]), perSource };
}

function shortenUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.slice(0, 30);
  }
}

// ============================================================================
// Merge logic
// ============================================================================

function preferLonger(a: string | null | undefined, b: string | null | undefined): string | null {
  const av = (a ?? "").trim();
  const bv = (b ?? "").trim();
  if (!av && !bv) return null;
  if (!av) return bv;
  if (!bv) return av;
  return av.length >= bv.length ? av : bv;
}

function mergeSites(sites: ExtractedSite[], primaryUrl: string): ExtractedSite {
  const first = sites[0];
  let merged: ExtractedSite = { ...first, url: primaryUrl };

  for (let i = 1; i < sites.length; i++) {
    merged = mergePair(merged, sites[i]);
  }
  return merged;
}

function mergePair(a: ExtractedSite, b: ExtractedSite): ExtractedSite {
  return {
    ...a,
    pageTitle: preferLonger(a.pageTitle, b.pageTitle),
    metaDescription: preferLonger(a.metaDescription, b.metaDescription),
    tagline: preferLonger(a.tagline ?? null, b.tagline ?? null) ?? undefined,
    about: preferLonger(a.about ?? null, b.about ?? null) ?? undefined,
    businessTypeHint:
      a.businessTypeHint && (a.businessTypeHint as string).length > 0
        ? a.businessTypeHint
        : b.businessTypeHint,
    address: preferLonger(a.address, b.address),
    phone: a.phone ?? b.phone,
    email: a.email ?? b.email,
    hours: a.hours ?? b.hours,
    services: dedupeByName(a.services, b.services),
    menuCategories: mergeMenu(a.menuCategories, b.menuCategories),
    staff: dedupeByName(a.staff, b.staff),
    testimonials: dedupeByKey(a.testimonials, b.testimonials, (t) =>
      t.quote.slice(0, 80).toLowerCase()
    ),
    faqs: dedupeByKey(a.faqs, b.faqs, (f) => f.question.toLowerCase()),
    serviceAreas: dedupeStrings(a.serviceAreas, b.serviceAreas),
    insuranceAccepted: dedupeStrings(a.insuranceAccepted, b.insuranceAccepted),
    brandColors: a.brandColors ?? b.brandColors,
    photos: Array.from(new Set([...a.photos, ...b.photos])).slice(0, MAX_PHOTOS_MERGED),
    socialLinks: { ...a.socialLinks, ...b.socialLinks },
    schemaOrg: [...a.schemaOrg, ...b.schemaOrg],
    htmlBytes: a.htmlBytes + b.htmlBytes,
  };
}

function dedupeByName<T extends { name: string }>(
  a?: T[],
  b?: T[]
): T[] | undefined {
  const all = [...(a ?? []), ...(b ?? [])];
  if (all.length === 0) return undefined;
  const seen = new Map<string, T>();
  for (const item of all) {
    const key = item.name.trim().toLowerCase();
    if (!key) continue;
    // Prefer the entry with more populated fields
    const existing = seen.get(key);
    if (!existing || populatedFieldCount(item) > populatedFieldCount(existing)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

function dedupeByKey<T>(
  a: T[] | undefined,
  b: T[] | undefined,
  keyFn: (t: T) => string
): T[] | undefined {
  const all = [...(a ?? []), ...(b ?? [])];
  if (all.length === 0) return undefined;
  const seen = new Map<string, T>();
  for (const item of all) {
    const key = keyFn(item);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

function dedupeStrings(a?: string[], b?: string[]): string[] | undefined {
  const all = [...(a ?? []), ...(b ?? [])];
  if (all.length === 0) return undefined;
  return Array.from(new Set(all.map((s) => s.trim()).filter(Boolean)));
}

function populatedFieldCount(obj: Record<string, unknown>): number {
  return Object.values(obj).filter(
    (v) => v !== null && v !== undefined && v !== ""
  ).length;
}

function mergeMenu(
  a?: ExtractedSite["menuCategories"],
  b?: ExtractedSite["menuCategories"]
): ExtractedSite["menuCategories"] | undefined {
  const all = [...(a ?? []), ...(b ?? [])];
  if (all.length === 0) return undefined;
  // Merge categories by name; concat items within them, dedup by item name
  const byName = new Map<string, ExtractedSite["menuCategories"] extends (infer X)[] | undefined ? X : never>();
  for (const cat of all) {
    const key = cat.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      const itemsByName = new Map<string, (typeof cat.items)[number]>();
      for (const it of [...existing.items, ...cat.items]) {
        const k = it.name.trim().toLowerCase();
        if (!itemsByName.has(k)) itemsByName.set(k, it);
      }
      existing.items = Array.from(itemsByName.values());
    } else {
      byName.set(key, { ...cat });
    }
  }
  return Array.from(byName.values());
}
