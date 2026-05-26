// Thin wrapper around Google Places API (New) — Text Search endpoint.
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
//
// Each operator brings their own API key (stored on the Operator row). We
// never call this with a platform-wide key in MVP.

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Field mask is REQUIRED by the new Places API. We ask for the minimum we
// need to populate a Lead row. Keep this small — pricing scales with fields.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.photos",
].join(",");

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  websiteUri: string | null;
  rating: number | null;
  reviewCount: number | null;
  lat: number | null;
  lng: number | null;
  primaryType: string | null;
  photoName: string | null; // raw "photos/{name}" — we don't fetch the image here
}

export interface SearchOptions {
  apiKey: string;
  textQuery: string; // e.g. "restaurants in Boulder, CO"
  /**
   * Total results to return. Google returns 20 per page; we paginate to
   * fulfill this. Capped at 60 so a single search is bounded in cost.
   */
  maxResults?: number; // default 20
  /**
   * Restrict to a Google "primary type" (e.g. "restaurant", "cafe"). When
   * set, only places whose primaryType matches are returned. Use this when
   * the operator picks a specific business category — it materially improves
   * relevance vs. a pure text query.
   */
  includedType?: string;
}

export class PlacesError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "PlacesError";
  }
}

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  photos?: Array<{ name?: string }>;
};
type RawResponse = { places?: RawPlace[]; nextPageToken?: string };

/** Perform a Text Search and return normalized place results. */
export async function searchPlaces(opts: SearchOptions): Promise<PlaceResult[]> {
  const { apiKey, textQuery, includedType } = opts;
  if (!apiKey) throw new PlacesError("Google Places API key is required", 0);
  if (!textQuery.trim()) throw new PlacesError("Text query is required", 0);

  const goal = Math.min(60, Math.max(1, opts.maxResults ?? 20));
  const collected: PlaceResult[] = [];
  let pageToken: string | undefined = undefined;

  // The new Places API returns up to 20 per page, with nextPageToken.
  // We page until we hit `goal` or Google stops returning a token. Capped
  // at 3 pages to bound cost.
  for (let page = 0; page < 3 && collected.length < goal; page++) {
    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: Math.min(20, goal - collected.length),
    };
    if (includedType) body.includedType = includedType;
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": `${FIELD_MASK},nextPageToken`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errBody: unknown = undefined;
      try {
        errBody = await res.json();
      } catch {
        /* ignore */
      }
      throw new PlacesError(
        `Google Places request failed: ${res.status} ${res.statusText}`,
        res.status,
        errBody
      );
    }
    const data = (await res.json()) as RawResponse;
    for (const p of data.places ?? []) {
      const norm = normalizePlace(p);
      if (norm) collected.push(norm);
      if (collected.length >= goal) break;
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return collected;
}

function normalizePlace(p: RawPlace): PlaceResult | null {
  if (!p.id || !p.displayName?.text) return null;
  const c = extractAddressParts(p.addressComponents ?? []);
  return {
    placeId: p.id,
    name: p.displayName.text,
    address: p.formattedAddress ?? null,
    city: c.city,
    state: c.state,
    zip: c.zip,
    phone: p.nationalPhoneNumber ?? null,
    websiteUri: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    primaryType: p.primaryTypeDisplayName?.text ?? p.primaryType ?? null,
    photoName: p.photos?.[0]?.name ?? null,
  };
}

function extractAddressParts(
  components: Array<{ longText?: string; shortText?: string; types?: string[] }>
): { city: string | null; state: string | null; zip: string | null } {
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;
  for (const c of components) {
    if (!c.types) continue;
    if (c.types.includes("locality")) city = c.longText ?? null;
    else if (!city && c.types.includes("sublocality")) city = c.longText ?? null;
    else if (c.types.includes("administrative_area_level_1"))
      state = c.shortText ?? c.longText ?? null;
    else if (c.types.includes("postal_code")) zip = c.shortText ?? c.longText ?? null;
  }
  return { city, state, zip };
}

// Domains we treat as "not a real website" — these signal the business
// doesn't have its own site, just a social/directory presence. A place
// whose only URL is one of these is still a prospect.
const WEAK_WEBSITE_HOSTS = [
  "facebook.com",
  "m.facebook.com",
  "instagram.com",
  "yelp.com",
  "google.com",
  "sites.google.com",
  "linktr.ee",
  "linkedin.com",
  "tripadvisor.com",
  "doordash.com",
  "ubereats.com",
  "grubhub.com",
  "menupages.com",
  "opentable.com",
  "toasttab.com",
  "seamless.com",
];

function isWeakWebsite(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return WEAK_WEBSITE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Filter to places without a "real" website. Includes places with no
 * website at all AND places whose only URL is a social/directory listing
 * (Facebook, Yelp, Instagram, DoorDash, etc.) — those businesses still
 * need a real site.
 */
export function filterNoWebsite(places: PlaceResult[]): PlaceResult[] {
  return places.filter(
    (p) => !p.websiteUri || p.websiteUri.trim() === "" || isWeakWebsite(p.websiteUri)
  );
}
