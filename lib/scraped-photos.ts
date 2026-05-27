// Download photos found by the auto-scrape engine and pipe them through the
// existing uploadImage() pipeline so they become first-class restaurant
// assets (hero, logo, gallery, menu item images).
//
// All public helpers run server-side only — they touch the network and
// disk/blob storage.

import { uploadImage, deleteImage } from "./upload";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per scraped image
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; RestaurantPlatformBot/1.0; +https://restaurantplatform.dev/bot)";

const IMAGE_MIMES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export class PhotoFetchError extends Error {
  constructor(message: string, public readonly url: string) {
    super(message);
    this.name = "PhotoFetchError";
  }
}

interface FetchedPhoto {
  file: File;
  url: string;
  bytes: number;
  contentType: string;
}

async function fetchPhoto(url: string): Promise<FetchedPhoto> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new PhotoFetchError(`HTTP ${res.status}`, url);
    }
    const ct = (res.headers.get("content-type") ?? "").toLowerCase().split(";")[0];
    if (!IMAGE_MIMES[ct]) {
      // Some hosts mis-label or use application/octet-stream — try to infer from extension
      const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
      const inferred = Object.entries(IMAGE_MIMES).find(([_, e]) => e === ext);
      if (!inferred) {
        throw new PhotoFetchError(`Not an image (content-type: ${ct || "unknown"})`, url);
      }
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      throw new PhotoFetchError(
        `Image too large (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)`,
        url
      );
    }
    if (buf.byteLength === 0) {
      throw new PhotoFetchError("Empty body", url);
    }
    const finalMime = IMAGE_MIMES[ct] ? ct : "image/jpeg";
    const ext = IMAGE_MIMES[finalMime] ?? "jpg";
    const name = `scraped-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const file = new File([buf], name, { type: finalMime });
    return { file, url, bytes: buf.byteLength, contentType: finalMime };
  } catch (e) {
    if (e instanceof PhotoFetchError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new PhotoFetchError(`Timed out after ${FETCH_TIMEOUT_MS}ms`, url);
    }
    throw new PhotoFetchError(
      e instanceof Error ? e.message : "Fetch failed",
      url
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download + save a single scraped photo as the restaurant's hero or logo.
 * Returns the new stored URL, or null on failure.
 */
export async function ingestScrapedPhotoAsAsset(
  slug: string,
  sourceUrl: string,
  kind: "hero" | "logo"
): Promise<string | null> {
  try {
    const photo = await fetchPhoto(sourceUrl);
    return await uploadImage(slug, photo.file, kind);
  } catch (e) {
    console.warn(
      `[scraped-photos] Failed to ingest ${kind} from ${sourceUrl}:`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * Bulk ingest scraped photos. Returns the new URLs for the ones that
 * succeeded; logs and skips failures. Use this to seed a gallery.
 */
export async function ingestScrapedPhotos(
  slug: string,
  sourceUrls: string[],
  kind: "hero" | "logo" | "items",
  max = 20
): Promise<string[]> {
  const urls = sourceUrls.slice(0, max);
  const results: string[] = [];
  for (const u of urls) {
    try {
      const photo = await fetchPhoto(u);
      const newUrl = await uploadImage(slug, photo.file, kind);
      results.push(newUrl);
    } catch (e) {
      console.warn(
        `[scraped-photos] Skipping ${u}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return results;
}

/**
 * Pick the most "hero-like" photo from a candidate list. Heuristics:
 *   - prefer URLs containing 'hero', 'banner', 'cover', 'og'
 *   - prefer larger filenames (often higher-res)
 *   - fall back to the first
 */
export function pickHeroCandidate(urls: string[]): string | null {
  if (urls.length === 0) return null;
  const score = (u: string): number => {
    let s = 0;
    const lower = u.toLowerCase();
    if (/hero|banner|cover|og[-_]?image|main/.test(lower)) s += 100;
    if (/header|landing|home/.test(lower)) s += 30;
    if (/thumb|icon|favicon|logo|avatar|profile/.test(lower)) s -= 80;
    if (/-\d{3,4}x\d{3,4}\./.test(lower)) s += 20; // sized URLs often indicate intentional assets
    if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(lower)) s += 5;
    return s;
  };
  const sorted = [...urls].sort((a, b) => score(b) - score(a));
  return sorted[0] ?? null;
}

/**
 * Re-export deleteImage so callers can roll back partial ingests without
 * importing two paths.
 */
export { deleteImage };
