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
  maxResults?: number; // 1-20, default 20
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

/** Perform a Text Search and return normalized place results. */
export async function searchPlaces(opts: SearchOptions): Promise<PlaceResult[]> {
  const { apiKey, textQuery } = opts;
  if (!apiKey) throw new PlacesError("Google Places API key is required", 0);
  if (!textQuery.trim()) throw new PlacesError("Text query is required", 0);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: Math.min(20, Math.max(1, opts.maxResults ?? 20)),
    }),
  });

  if (!res.ok) {
    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new PlacesError(
      `Google Places request failed: ${res.status} ${res.statusText}`,
      res.status,
      body
    );
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
  type RawResponse = { places?: RawPlace[] };
  const data = (await res.json()) as RawResponse;
  const places = data.places ?? [];

  return places
    .map((p): PlaceResult | null => {
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
        primaryType:
          p.primaryTypeDisplayName?.text ?? p.primaryType ?? null,
        photoName: p.photos?.[0]?.name ?? null,
      };
    })
    .filter((p): p is PlaceResult => p !== null);
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

/** Filter a result list to only places without a website. */
export function filterNoWebsite(places: PlaceResult[]): PlaceResult[] {
  return places.filter((p) => !p.websiteUri || p.websiteUri.trim() === "");
}
