import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { type ClientType } from "./client-type";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
function normalizeHex(input: string, fallback: string): string {
  const s = (input ?? "").trim();
  if (HEX_COLOR_RE.test(s)) return s;
  // Allow "C8542C" without leading '#'
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`;
  // Allow 3-char shorthand like "#abc"
  const m = s.match(/^#?([0-9A-Fa-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

const ServiceSchema = z.object({
  name: z.string().describe("Short service name, e.g. 'Haircut' or 'Hot stone massage'"),
  description: z
    .string()
    .max(200)
    .describe("One-sentence description of the service")
    .optional(),
  priceCents: z
    .number()
    .int()
    .nullable()
    .describe(
      "Typical price in CENTS (e.g. 4500 for $45). Use null if pricing varies/quote required."
    ),
  duration: z
    .string()
    .nullable()
    .describe("Typical duration, e.g. '45 min' or '1 hr'. Null if not applicable."),
});

const GenerationResultSchema = z.object({
  tagline: z
    .string()
    .max(180)
    .describe("Catchy one-line tagline for the hero section (under 180 chars)"),
  heroHeadline: z
    .string()
    .max(180)
    .describe("Short hero headline (5-9 words) used as the visual focal point"),
  heroSubhead: z
    .string()
    .max(280)
    .describe("Supporting hero subheading, 1-2 sentences, sets the tone"),
  aboutCopy: z
    .string()
    .max(2000)
    .describe(
      "Warm, authentic 'About' section — 2-4 short paragraphs. Speak in the business's voice. Avoid clichés like 'state of the art' or 'world-class'. Separate paragraphs with blank lines."
    ),
  services: z
    .array(ServiceSchema)
    .max(8)
    .describe(
      "If type is service_business: 3-6 core services. For restaurants: leave empty array."
    )
    .default([]),
  primaryColor: z
    .string()
    .describe(
      "A primary brand hex color in #RRGGBB format that fits the business mood (e.g. '#C8542C')"
    ),
  accentColor: z
    .string()
    .describe(
      "A complementary accent hex color in #RRGGBB format (e.g. '#2D5A3D')"
    ),
});

export type GenerationResult = z.infer<typeof GenerationResultSchema>;

export interface GenerateInput {
  brief: string;
  type: ClientType;
  businessName: string;
  city?: string;
}

const TYPE_GUIDE: Record<ClientType, string> = {
  restaurant:
    "Restaurant/cafe/bar/bakery. Skip the services list (leave empty). Focus on the food vibe, atmosphere, what makes the menu special.",
  trade_service:
    "Home/trade services (HVAC, plumber, electrician, landscaper, auto repair). Generate 3-6 services like 'AC tune-up', 'Drain cleaning', 'Spring cleanup' with realistic flat-rate or starting-at pricing. Voice: trustworthy, fast, fair-priced, family-owned. Emphasize free quotes and licensed/insured trust signals.",
  personal_service:
    "Salon/barber/spa/nail studio/massage. Generate 4-8 services like 'Cut & Style', 'Color', 'Mens Cut' with prices and typical durations. Voice: welcoming, polished, modern. Mention booking + walk-in policy if relevant.",
  professional_service:
    "Lawyer/accountant/real estate/insurance/consultant. Generate 3-5 practice areas or service offerings (no/optional pricing — most use consultation). Voice: credible, calm, expert. Emphasize free consultation if appropriate.",
  healthcare:
    "Healthcare clinic (dentist, doctor, vet, chiropractor, optometrist, therapist). Generate 3-6 services like 'New patient exam', 'Cleaning', 'X-rays' with prices when typical. Voice: warm, professional, reassuring. Mention insurance + new-patient welcome if relevant.",
  fitness:
    "Gym/yoga/pilates/dance studio/CrossFit. Generate 4-6 offerings — class types, membership tiers, or training packages — with prices. Voice: motivating but not aggressive, community-oriented. Mention free first class / trial week if relevant.",
  retail:
    "Boutique/florist/bookstore/gift shop. Skip the services list (leave empty). Focus on the in-store experience, what they carry, the personality of the shop.",
  service_business:
    "Generic service business (cleaner, tutor, photographer, other). Generate 3-6 representative offerings with realistic pricing for the locale where possible.",
};

const SYSTEM_PROMPT = `You write polished, warm marketing copy for small local-business landing pages.

The copy goes on a real customer-facing page used to walk into a business and pitch a consulting engagement, so it has to feel authentic — like the owner themselves wrote it.

Rules:
- Concrete and specific. No empty marketing-speak ("state of the art", "premier destination", "best in class").
- Conversational, second-person ("we", "you"), warm but not cloying.
- Match the vibe of the business type and any details in the brief.
- The aboutCopy should be 2-4 short paragraphs. Use \\n\\n between them.
- Color palette: pick colors that match the business's mood. Restaurants often warm/earthy. Salons/spas often deeper/refined. Gyms often bold/high-contrast. Avoid pure black/white as primary.
- If the brief is sparse, infer reasonable details rather than asking — these are first-draft demos the user will edit.`;

export async function generateLandingCopy(input: GenerateInput): Promise<GenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env to enable AI generation."
    );
  }

  const prompt = `Business name: ${input.businessName}
Business type: ${input.type}
${input.city ? `Location: ${input.city}\n` : ""}
Type-specific guidance: ${TYPE_GUIDE[input.type]}

Brief from the consultant:
${input.brief.trim()}

Generate the landing-page copy.`;

  try {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-5"),
      schema: GenerationResultSchema,
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 4000,
      temperature: 0.7,
    });

    return {
      ...object,
      primaryColor: normalizeHex(object.primaryColor, "#C8542C"),
      accentColor: normalizeHex(object.accentColor, "#2D5A3D"),
    };
  } catch (e) {
    // generateObject throws NoObjectGeneratedError when the model output
    // can't be coerced into the schema. The raw text usually IS valid JSON
    // that just had a stray issue (color missing '#', extra field, etc.) —
    // try to salvage it before bubbling up.
    if (NoObjectGeneratedError.isInstance(e) && e.text) {
      const salvaged = trySalvage(e.text);
      if (salvaged) return salvaged;
    }
    throw e;
  }
}

// ============================================================================
// Menu extraction — parses pasted menu text into MenuCategory + MenuItem rows
// ============================================================================

const MenuItemExtractSchema = z.object({
  name: z.string().min(1).max(120).describe("Item name as written on the menu"),
  description: z
    .string()
    .max(400)
    .optional()
    .describe("Short item description, if present on the menu"),
  priceCents: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe(
      "Price in CENTS (e.g. 1299 for $12.99). Use null when price is market/varies/absent."
    ),
});

const MenuCategoryExtractSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .describe(
      "Section name as it appears on the menu (e.g. 'Breakfast', 'Burritos', 'Drinks'). If the menu has no sections, use 'Menu'."
    ),
  description: z
    .string()
    .max(280)
    .optional()
    .describe("Optional sub-header text under the section, if present"),
  items: z.array(MenuItemExtractSchema).max(80),
});

const MenuExtractSchema = z.object({
  categories: z.array(MenuCategoryExtractSchema).max(40),
});

export type ExtractedMenu = z.infer<typeof MenuExtractSchema>;

const MENU_EXTRACT_SYSTEM = `You parse pasted restaurant menu text into structured categories and items.

Rules:
- Preserve the menu's natural section grouping (Breakfast, Lunch, Burritos, Drinks, etc.). If items aren't grouped, put them all under a single section called "Menu".
- Item names should match the menu exactly. Don't paraphrase.
- Descriptions are only the descriptive text under an item — short ingredient list or tagline. Do NOT include the price in the description.
- Convert prices to CENTS as an integer (e.g. "$12.99" → 1299, "12" → 1200, "10.5" → 1050).
- For "market price", "MP", "varies", or missing price: use null for priceCents.
- Skip non-menu text: hours, addresses, footers, allergen disclaimers, intro paragraphs.
- Skip duplicates. If the same item appears twice (e.g. across breakfast/lunch), include it once under whichever section makes more sense.
- Cap reasonable: up to ~80 items per category, up to 20 categories total.`;

export async function extractMenuFromText(text: string): Promise<ExtractedMenu> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env to enable menu extraction."
    );
  }
  const trimmed = text.trim();
  if (trimmed.length < 10) {
    throw new Error("Menu text is too short to parse.");
  }

  try {
    const { object } = await generateObject({
      // Haiku 4.5 is ~3x faster than Sonnet here. Menu extraction is pattern
      // matching, not creative writing — Haiku handles it cleanly.
      model: anthropic("claude-haiku-4-5"),
      schema: MenuExtractSchema,
      system: MENU_EXTRACT_SYSTEM,
      prompt: `Parse this menu into structured sections and items:\n\n${trimmed}`,
      maxTokens: 8000,
      temperature: 0.1,
    });
    return cleanExtractedMenu(object);
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e) && e.text) {
      const salvaged = trySalvageMenu(e.text);
      if (salvaged) return salvaged;
    }
    throw e;
  }
}

function cleanExtractedMenu(menu: ExtractedMenu): ExtractedMenu {
  return {
    categories: menu.categories
      .map((c) => ({
        name: c.name.trim().slice(0, 80),
        description: c.description?.trim().slice(0, 280) || undefined,
        items: c.items
          .map((i) => ({
            name: i.name.trim().slice(0, 120),
            description: i.description?.trim().slice(0, 400) || undefined,
            priceCents:
              i.priceCents !== null && Number.isFinite(i.priceCents)
                ? Math.max(0, Math.round(i.priceCents))
                : null,
          }))
          .filter((i) => i.name.length > 0),
      }))
      .filter((c) => c.name.length > 0 && c.items.length > 0),
  };
}

function trySalvageMenu(raw: string): ExtractedMenu | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  // Coerce/truncate everything to fit the schema, then re-validate. The
  // raw object is almost always usable — we just need to fit the caps.
  const o = parsed as Record<string, unknown>;
  const rawCats = Array.isArray(o.categories) ? o.categories : [];
  const coercedCats = rawCats.slice(0, 40).map((c) => {
    const cat = (c ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(cat.items) ? cat.items : [];
    return {
      name: typeof cat.name === "string" ? cat.name.slice(0, 80) : "Menu",
      description:
        typeof cat.description === "string" && cat.description.trim().length > 0
          ? cat.description.slice(0, 280)
          : undefined,
      items: rawItems.slice(0, 80).map((i) => {
        const it = (i ?? {}) as Record<string, unknown>;
        return {
          name: typeof it.name === "string" ? it.name.slice(0, 120) : "",
          description:
            typeof it.description === "string" && it.description.trim().length > 0
              ? it.description.slice(0, 400)
              : undefined,
          priceCents:
            typeof it.priceCents === "number" && Number.isFinite(it.priceCents)
              ? Math.max(0, Math.round(it.priceCents))
              : null,
        };
      }),
    };
  });
  const candidate = { categories: coercedCats };
  const result = MenuExtractSchema.safeParse(candidate);
  return result.success ? cleanExtractedMenu(result.data) : null;
}

function trySalvage(raw: string): GenerationResult | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const truncate = (v: unknown, n: number) =>
    typeof v === "string" ? v.slice(0, n) : "";
  const candidate = {
    tagline: truncate(o.tagline, 180),
    heroHeadline: truncate(o.heroHeadline, 180),
    heroSubhead: truncate(o.heroSubhead, 280),
    aboutCopy: truncate(o.aboutCopy, 2000),
    primaryColor: normalizeHex(String(o.primaryColor ?? ""), "#C8542C"),
    accentColor: normalizeHex(String(o.accentColor ?? ""), "#2D5A3D"),
    services: Array.isArray(o.services)
      ? o.services
          .slice(0, 8)
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const r = s as Record<string, unknown>;
            return {
              name: truncate(r.name, 120),
              description:
                typeof r.description === "string"
                  ? r.description.slice(0, 200)
                  : undefined,
              priceCents:
                typeof r.priceCents === "number" ? Math.round(r.priceCents) : null,
              duration: typeof r.duration === "string" ? r.duration : null,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null && !!s.name)
      : [],
  };
  const result = GenerationResultSchema.safeParse(candidate);
  return result.success ? result.data : null;
}
