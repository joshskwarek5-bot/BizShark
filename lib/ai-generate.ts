import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { type ClientType } from "./client-type";

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
    .max(120)
    .describe("Catchy one-line tagline for the hero section (under 120 chars)"),
  heroHeadline: z
    .string()
    .max(80)
    .describe("Short hero headline (5-7 words) used as the visual focal point"),
  heroSubhead: z
    .string()
    .max(200)
    .describe("Supporting hero subheading, 1-2 sentences, sets the tone"),
  aboutCopy: z
    .string()
    .max(800)
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
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .describe("A primary brand hex color that fits the business mood"),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .describe("A complementary accent hex color"),
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
    "Restaurant/café/bar. Skip the services list (leave empty). Focus on the food vibe, atmosphere, what makes the menu special.",
  service_business:
    "Service business (salon, gym, spa, contractor, etc.). Generate a services list with 3-6 representative offerings, with realistic typical pricing for the locale where possible.",
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

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-5"),
    schema: GenerationResultSchema,
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 2000,
    temperature: 0.7,
  });

  return object;
}
