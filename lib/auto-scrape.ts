// Auto-scrape engine — fetches a business's existing public website,
// extracts everything useful (about, services, menu, staff, photos, hours,
// contact, testimonials) into a structured dump the orchestrator can feed
// into the rest of the AI pipeline (copy gen, menu importer, image enhance).
//
// Strategy:
//   1) fetch the URL with sane timeouts + size caps
//   2) pull out structured signals dependency-free: <title>, meta tags,
//      JSON-LD blocks (huge for restaurants/LocalBusiness), all <img> URLs,
//      phone/email regex
//   3) strip HTML to text, truncate, hand to Claude with an extraction prompt
//   4) merge Claude's structured output with the regex-extracted signals
//   5) return a typed ExtractedSite — same shape regardless of source

import { z } from "zod";
import { generateObject, NoObjectGeneratedError } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS_FOR_AI = 50_000;
const MAX_IMAGES_RETURNED = 40;
const USER_AGENT =
  "Mozilla/5.0 (compatible; RestaurantPlatformBot/1.0; +https://restaurantplatform.dev/bot)";

export class ScrapeError extends Error {
  constructor(
    message: string,
    public readonly status: number = 0,
    public readonly url?: string
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}

// ============================================================================
// Output schema — what the rest of the system consumes
// ============================================================================

const ExtractedServiceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional().nullable(),
  priceCents: z.number().int().min(0).nullable().optional(),
  duration: z.string().max(40).nullable().optional(),
  category: z.string().max(80).optional().nullable(),
});

const ExtractedMenuItemSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional().nullable(),
  priceCents: z.number().int().min(0).nullable().optional(),
});

const ExtractedMenuCategorySchema = z.object({
  name: z.string().min(1).max(80),
  items: z.array(ExtractedMenuItemSchema).max(80),
});

const ExtractedStaffSchema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().max(120).optional().nullable(),
  bio: z.string().max(600).optional().nullable(),
  specialties: z.array(z.string().max(80)).max(8).optional(),
});

const ExtractedTestimonialSchema = z.object({
  quote: z.string().min(1).max(800),
  author: z.string().max(120).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
});

const ExtractedFAQSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(800),
});

const ExtractedSiteSchema = z.object({
  tagline: z.string().max(180).optional().nullable(),
  about: z.string().max(2000).optional().nullable(),
  /** Inferred from any signals on the page; "" if unknown. */
  businessTypeHint: z
    .enum([
      "restaurant",
      "trade_service",
      "personal_service",
      "professional_service",
      "healthcare",
      "fitness",
      "retail",
      "service_business",
      "",
    ])
    .optional(),
  services: z.array(ExtractedServiceSchema).max(20).optional(),
  menuCategories: z.array(ExtractedMenuCategorySchema).max(20).optional(),
  staff: z.array(ExtractedStaffSchema).max(20).optional(),
  testimonials: z.array(ExtractedTestimonialSchema).max(12).optional(),
  faqs: z.array(ExtractedFAQSchema).max(12).optional(),
  serviceAreas: z.array(z.string().max(80)).max(20).optional(),
  insuranceAccepted: z.array(z.string().max(80)).max(20).optional(),
  /** Hex colors lifted from the brand palette. */
  brandColors: z
    .object({
      primary: z.string().optional().nullable(),
      accent: z.string().optional().nullable(),
    })
    .optional(),
});

export type ExtractedSiteAI = z.infer<typeof ExtractedSiteSchema>;

export interface ExtractedSite extends ExtractedSiteAI {
  url: string;
  fetchedAt: string;
  /** Page <title>. */
  pageTitle: string | null;
  /** Page meta description. */
  metaDescription: string | null;
  /** Hours map { mon: "9-5", tue: "9-5", ... } when discoverable. */
  hours: Record<string, string> | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** Absolute URLs of images on the page (deduped, capped). */
  photos: string[];
  socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    yelp?: string;
    tiktok?: string;
    youtube?: string;
  };
  /** Raw JSON-LD blocks found on the page — useful for downstream debugging. */
  schemaOrg: unknown[];
  /** Bytes of HTML fetched (for logging/billing). */
  htmlBytes: number;
}

// ============================================================================
// Public entrypoint
// ============================================================================

export interface ScrapeOptions {
  url: string;
  /** Anthropic key — pass platform key here. Defaults to ANTHROPIC_API_KEY env. */
  apiKey?: string;
  /** Hint to bias the extraction prompt (when known from the lead). */
  knownBusinessType?: string;
  knownBusinessName?: string;
}

export async function scrapeBusinessSite(opts: ScrapeOptions): Promise<ExtractedSite> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ScrapeError(
      "ANTHROPIC_API_KEY required for auto-scrape AI extraction"
    );
  }
  const url = normalizeUrl(opts.url);

  // 1) Fetch the HTML
  const { html, status } = await fetchHtml(url);
  if (status >= 400) {
    throw new ScrapeError(`Page returned HTTP ${status}`, status, url);
  }
  const htmlBytes = html.length;

  // 2) Regex pass — cheap structural signals
  const pageTitle = extractTitle(html);
  const metaDescription = extractMetaDescription(html);
  const schemaOrg = extractJsonLd(html);
  const photos = extractImages(html, url).slice(0, MAX_IMAGES_RETURNED);
  const phone = extractPhone(html);
  const email = extractEmail(html);
  const socialLinks = extractSocialLinks(html);
  const { hours: schemaHours, address: schemaAddress } = harvestFromSchemaOrg(schemaOrg);
  const text = stripToText(html).slice(0, MAX_TEXT_CHARS_FOR_AI);

  // 3) AI pass — semantic extraction
  let aiResult: ExtractedSiteAI = {};
  try {
    aiResult = await aiExtract({
      text,
      url,
      pageTitle,
      metaDescription,
      knownType: opts.knownBusinessType,
      knownName: opts.knownBusinessName,
      schemaOrgSummary: summarizeSchemaOrg(schemaOrg),
    });
  } catch (e) {
    console.warn("[auto-scrape] AI extraction failed (continuing with structural data):", e);
  }

  return {
    url,
    fetchedAt: new Date().toISOString(),
    pageTitle,
    metaDescription,
    hours: schemaHours,
    address: schemaAddress,
    phone,
    email,
    photos,
    socialLinks,
    schemaOrg,
    htmlBytes,
    ...aiResult,
  };
}

// ============================================================================
// Fetcher
// ============================================================================

async function fetchHtml(url: string): Promise<{ html: string; status: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      throw new ScrapeError(
        `Page is not HTML (content-type: ${contentType})`,
        res.status,
        url
      );
    }
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { html: text.slice(0, MAX_HTML_BYTES), status: res.status };
    }
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > MAX_HTML_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { html: buf.toString("utf8"), status: res.status };
  } catch (e) {
    if (e instanceof ScrapeError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ScrapeError(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`, 0, url);
    }
    throw new ScrapeError(
      e instanceof Error ? e.message : "Unknown fetch error",
      0,
      url
    );
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  // Validate
  try {
    const u = new URL(s);
    if (!u.hostname) throw new Error("no hostname");
    return u.toString();
  } catch {
    throw new ScrapeError(`Not a valid URL: ${input}`);
  }
}

// ============================================================================
// Regex extractors
// ============================================================================

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()).slice(0, 200) : null;
}

function extractMetaDescription(html: string): string | null {
  const m =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1].trim()).slice(0, 400) : null;
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // Tolerate broken JSON-LD blocks
    }
  }
  return blocks;
}

function extractImages(html: string, baseUrl: string): string[] {
  const found = new Set<string>();
  // <img src=...>
  const reImg = /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = reImg.exec(html)) !== null) {
    const abs = resolveUrl(m[1], baseUrl);
    if (isImageUrl(abs)) found.add(abs);
  }
  // <source srcset=...> (for picture/responsive)
  const reSrcset = /srcset=["']([^"']+)["']/gi;
  while ((m = reSrcset.exec(html)) !== null) {
    const first = m[1].split(",")[0].trim().split(/\s+/)[0];
    if (first) {
      const abs = resolveUrl(first, baseUrl);
      if (isImageUrl(abs)) found.add(abs);
    }
  }
  // og:image
  const reOg = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/gi;
  while ((m = reOg.exec(html)) !== null) {
    const abs = resolveUrl(m[1], baseUrl);
    if (isImageUrl(abs)) found.add(abs);
  }
  return Array.from(found);
}

function isImageUrl(u: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u);
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractPhone(html: string): string | null {
  // tel: links first (most reliable)
  const tel = html.match(/href=["']tel:([^"']+)["']/i);
  if (tel) return tel[1].trim();
  // Fallback: US-style phone in plain text
  const text = stripToText(html);
  const m = text.match(/(\(?\d{3}\)?[ .\-]?\d{3}[ .\-]?\d{4})/);
  return m ? m[1] : null;
}

function extractEmail(html: string): string | null {
  const mailto = html.match(/href=["']mailto:([^"'?]+)["']/i);
  if (mailto) return mailto[1].trim();
  const text = stripToText(html);
  const m = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : null;
}

function extractSocialLinks(html: string): ExtractedSite["socialLinks"] {
  const links: ExtractedSite["socialLinks"] = {};
  const patterns: Array<[keyof ExtractedSite["socialLinks"], RegExp]> = [
    ["facebook", /href=["'](https?:\/\/(?:www\.|m\.)?facebook\.com\/[^"']+)["']/i],
    ["instagram", /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i],
    ["twitter", /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i],
    ["yelp", /href=["'](https?:\/\/(?:www\.)?yelp\.com\/[^"']+)["']/i],
    ["tiktok", /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/[^"']+)["']/i],
    ["youtube", /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"']+)["']/i],
  ];
  for (const [key, re] of patterns) {
    const m = html.match(re);
    if (m) links[key] = m[1];
  }
  return links;
}

// ============================================================================
// schema.org / JSON-LD harvesting
// ============================================================================

function harvestFromSchemaOrg(
  blocks: unknown[]
): { hours: Record<string, string> | null; address: string | null } {
  let hours: Record<string, string> | null = null;
  let address: string | null = null;

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const items = Array.isArray(block) ? block : [block];
    for (const item of items as Record<string, unknown>[]) {
      // openingHours can be string, array of strings, or openingHoursSpecification[]
      if (!hours && item.openingHours) {
        hours = parseOpeningHours(item.openingHours);
      }
      if (!hours && Array.isArray(item.openingHoursSpecification)) {
        hours = parseOpeningHoursSpecification(item.openingHoursSpecification);
      }
      if (!address && item.address) {
        address = stringifyAddress(item.address);
      }
    }
  }
  return { hours, address };
}

function parseOpeningHours(raw: unknown): Record<string, string> | null {
  const lines: string[] = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : typeof raw === "string"
      ? [raw]
      : [];
  if (lines.length === 0) return null;
  const out: Record<string, string> = {};
  const days: Record<string, string> = {
    mo: "mon",
    tu: "tue",
    we: "wed",
    th: "thu",
    fr: "fri",
    sa: "sat",
    su: "sun",
  };
  for (const line of lines) {
    // e.g. "Mo-Fr 09:00-17:00" or "Su 11:00-15:00"
    const m = line.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
    if (!m) continue;
    const start = days[m[1].toLowerCase()];
    const end = m[2] ? days[m[2].toLowerCase()] : start;
    if (!start || !end) continue;
    const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const i = order.indexOf(start);
    const j = order.indexOf(end);
    if (i < 0 || j < 0) continue;
    const time = `${m[3]}-${m[4]}`;
    for (let k = i; k <= j; k++) out[order[k]] = time;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseOpeningHoursSpecification(
  specs: unknown[]
): Record<string, string> | null {
  const order: Record<string, string> = {
    monday: "mon",
    tuesday: "tue",
    wednesday: "wed",
    thursday: "thu",
    friday: "fri",
    saturday: "sat",
    sunday: "sun",
  };
  const out: Record<string, string> = {};
  for (const s of specs) {
    if (!s || typeof s !== "object") continue;
    const spec = s as Record<string, unknown>;
    const day = spec.dayOfWeek;
    const opens = typeof spec.opens === "string" ? spec.opens : null;
    const closes = typeof spec.closes === "string" ? spec.closes : null;
    if (!opens || !closes) continue;
    const dayList: string[] = Array.isArray(day)
      ? day.filter((d): d is string => typeof d === "string")
      : typeof day === "string"
        ? [day]
        : [];
    for (const d of dayList) {
      const key = order[d.toLowerCase().split("/").pop() ?? ""];
      if (key) out[key] = `${opens}-${closes}`;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function stringifyAddress(addr: unknown): string | null {
  if (typeof addr === "string") return addr;
  if (!addr || typeof addr !== "object") return null;
  const a = addr as Record<string, unknown>;
  const parts = [
    a.streetAddress,
    a.addressLocality,
    a.addressRegion,
    a.postalCode,
  ].filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function summarizeSchemaOrg(blocks: unknown[]): string {
  // Keep it short for the AI prompt — just type + name signals
  const summary: string[] = [];
  for (const b of blocks.slice(0, 5)) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const t = typeof o["@type"] === "string" ? o["@type"] : "Unknown";
    const n = typeof o.name === "string" ? o.name : "";
    summary.push(`${t}${n ? `: ${n}` : ""}`);
  }
  return summary.slice(0, 5).join("; ");
}

// ============================================================================
// HTML → text
// ============================================================================

function stripToText(html: string): string {
  return html
    // Remove style/script blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    // Replace block tags with newlines
    .replace(/<\/?(?:br|p|li|div|h\d|tr|td|section|article|header|footer)[^>]*>/gi, "\n")
    // Strip all other tags
    .replace(/<[^>]+>/g, " ")
    // Decode entities
    .split("\n")
    .map((line) => decodeEntities(line.replace(/\s+/g, " ").trim()))
    .filter((line) => line.length > 0)
    .join("\n");
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&trade;": "™",
  "&copy;": "©",
  "&reg;": "®",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, n) => String.fromCharCode(parseInt(n, 16))
    )
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
}

// ============================================================================
// AI semantic extraction
// ============================================================================

const AI_SYSTEM_PROMPT = `You extract structured business data from messy scraped website text.

Rules:
- ONLY include data that is clearly present in the source — never invent.
- Prices ALWAYS in CENTS as integers (e.g. $12.99 → 1299; "market price" → null).
- Inferences allowed for business type and tagline, but mark unknown as empty string for businessTypeHint.
- For services, set category when the source groups them (e.g. "Cuts", "Color", "Treatments" for a salon).
- For menu items, group under their section headers (e.g. "Breakfast", "Burritos").
- For testimonials, only include real quotes — skip "Lorem ipsum" or placeholder text.
- For brandColors, pull hex values from inline styles or CSS only if they appear repeatedly (i.e. they're the brand colors, not just one button).`;

async function aiExtract(args: {
  text: string;
  url: string;
  pageTitle: string | null;
  metaDescription: string | null;
  knownType?: string;
  knownName?: string;
  schemaOrgSummary: string;
}): Promise<ExtractedSiteAI> {
  const prompt = `Extract structured data from this scraped website.

URL: ${args.url}
Page title: ${args.pageTitle ?? "(none)"}
Meta description: ${args.metaDescription ?? "(none)"}
${args.knownName ? `Business name (known from lead): ${args.knownName}` : ""}
${args.knownType ? `Business type (known from lead): ${args.knownType}` : ""}
schema.org signals: ${args.schemaOrgSummary || "(none)"}

Scraped page text (truncated):
"""
${args.text}
"""

Return the structured extraction. Skip any field that doesn't have clear evidence on the page.`;

  try {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5"),
      schema: ExtractedSiteSchema,
      system: AI_SYSTEM_PROMPT,
      prompt,
      maxTokens: 6000,
      temperature: 0.1,
    });
    return object;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e) && e.text) {
      const salvaged = trySalvage(e.text);
      if (salvaged) return salvaged;
    }
    throw e;
  }
}

function trySalvage(raw: string): ExtractedSiteAI | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const r = ExtractedSiteSchema.safeParse(parsed);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
