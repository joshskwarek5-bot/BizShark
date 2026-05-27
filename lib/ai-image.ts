// Operator-BYO OpenAI image generation. Uses gpt-image-1 via OpenAI's
// REST API directly (no SDK) to avoid pulling a new dependency. Supports
// two modes:
//   1) edit: 1-3 reference images + a prompt → enhanced version
//   2) generate: prompt-only → from-scratch image
//
// Returns a File so it can pass through the existing uploadImage() pipeline.

const ENDPOINT_EDITS = "https://api.openai.com/v1/images/edits";
const ENDPOINT_GENERATE = "https://api.openai.com/v1/images/generations";

export class ImageGenError extends Error {
  constructor(
    message: string,
    public readonly status: number = 0,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ImageGenError";
  }
}

export type ImageKind = "hero" | "logo" | "item";

export interface EnhanceOptions {
  apiKey: string;
  /** What the image is for; drives prompt + size defaults. */
  kind: ImageKind;
  /** Free-form caption: dish name, restaurant name, etc. Optional. */
  subject?: string;
  /** Extra direction from the operator. Optional. */
  extra?: string;
  /** Up to 3 reference photos. If empty, falls back to text-to-image. */
  references?: File[];
  /** Output mime type. Defaults to png. */
  outputMime?: "image/png" | "image/jpeg" | "image/webp";
}

export interface EnhanceResult {
  file: File;
  /** Caller may want to surface what we sent. */
  promptUsed: string;
  model: "gpt-image-1";
  size: "1024x1024" | "1536x1024" | "1024x1536";
}

const SIZE_BY_KIND: Record<ImageKind, EnhanceResult["size"]> = {
  hero: "1536x1024", // wide hero banner
  item: "1024x1024", // square menu thumb
  logo: "1024x1024", // square logo
};

function basePrompt(kind: ImageKind, subject?: string, extra?: string): string {
  const subj = subject?.trim();
  const xtra = extra?.trim();
  const lines: string[] = [];
  switch (kind) {
    case "hero":
      lines.push(
        "Generate a polished, atmospheric hero banner for a restaurant website.",
        "Warm natural lighting, shallow depth of field, inviting and high-end but approachable.",
        "Wide aspect, leave room near the top for an overlaid headline.",
        "No on-image text, no watermarks, no logos."
      );
      if (subj) lines.push(`The restaurant is called "${subj}".`);
      break;
    case "item":
      lines.push(
        "Generate a clean overhead/three-quarter photograph of a single menu item.",
        "Restaurant food-photography quality: soft natural light, neutral plate or styled surface, no busy background.",
        "Tightly composed, square aspect, no text or props that distract from the dish."
      );
      if (subj) lines.push(`The dish is: ${subj}.`);
      break;
    case "logo":
      lines.push(
        "Generate a clean, modern logo mark on a flat neutral background.",
        "Vector-feel: limited palette, strong silhouette, balanced composition, square.",
        "No on-image taglines unless the brand name is explicitly part of the mark."
      );
      if (subj) lines.push(`The brand is "${subj}".`);
      break;
  }
  if (xtra) lines.push(`Additional direction from the operator: ${xtra}`);
  return lines.join(" ");
}

async function callOpenAIEdits(opts: {
  apiKey: string;
  prompt: string;
  size: EnhanceResult["size"];
  references: File[];
}): Promise<Blob> {
  const fd = new FormData();
  fd.append("model", "gpt-image-1");
  fd.append("prompt", opts.prompt);
  fd.append("size", opts.size);
  fd.append("n", "1");
  // gpt-image-1 returns base64 by default; ask for url so we don't bloat
  // the JSON. Stripe of an alternate: leave default and decode b64_json.
  // OpenAI says gpt-image-1 only returns b64_json — handle both.
  for (const ref of opts.references) {
    fd.append("image[]", ref, ref.name || "ref.png");
  }
  const res = await fetch(ENDPOINT_EDITS, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ImageGenError(
      `OpenAI /images/edits failed (${res.status})`,
      res.status,
      body
    );
  }
  return blobFromOpenAIResponse(await res.json());
}

async function callOpenAIGenerate(opts: {
  apiKey: string;
  prompt: string;
  size: EnhanceResult["size"];
}): Promise<Blob> {
  const res = await fetch(ENDPOINT_GENERATE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: opts.prompt,
      size: opts.size,
      n: 1,
    }),
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ImageGenError(
      `OpenAI /images/generations failed (${res.status})`,
      res.status,
      body
    );
  }
  return blobFromOpenAIResponse(await res.json());
}

async function blobFromOpenAIResponse(json: unknown): Promise<Blob> {
  const obj = json as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = obj?.data?.[0];
  if (!first) throw new ImageGenError("OpenAI returned no image data", 0, json);
  if (first.b64_json) {
    const bytes = Buffer.from(first.b64_json, "base64");
    return new Blob([bytes], { type: "image/png" });
  }
  if (first.url) {
    const r = await fetch(first.url);
    if (!r.ok) throw new ImageGenError(`Fetch generated image failed (${r.status})`, r.status);
    return await r.blob();
  }
  throw new ImageGenError("OpenAI response had neither b64_json nor url", 0, json);
}

export async function enhanceImage(opts: EnhanceOptions): Promise<EnhanceResult> {
  if (!opts.apiKey) {
    throw new ImageGenError("OpenAI API key is required.");
  }
  const size = SIZE_BY_KIND[opts.kind];
  const prompt = basePrompt(opts.kind, opts.subject, opts.extra);
  const refs = (opts.references ?? []).slice(0, 3);

  const blob =
    refs.length > 0
      ? await callOpenAIEdits({
          apiKey: opts.apiKey,
          prompt,
          size,
          references: refs,
        })
      : await callOpenAIGenerate({ apiKey: opts.apiKey, prompt, size });

  // gpt-image-1 always returns PNG. Wrap it as a File so the existing
  // uploadImage() pipeline accepts it without changes.
  const outMime = opts.outputMime ?? "image/png";
  const ext = outMime === "image/jpeg" ? "jpg" : outMime === "image/webp" ? "webp" : "png";
  const name = `ai-${opts.kind}-${Date.now()}.${ext}`;
  const file = new File([blob], name, { type: outMime });

  return { file, promptUsed: prompt, model: "gpt-image-1", size };
}

/**
 * Generate a dish photo for a single menu item using text-to-image (no
 * reference photos). Returns the public URL after the file has been written
 * through the shared uploadImage() pipeline. Caller is responsible for
 * writing the URL to MenuItem.imageUrl.
 */
export async function generatePhotoForMenuItem(args: {
  slug: string;
  openaiApiKey: string;
  item: { name: string; description?: string | null };
  /** Optional cuisine hint, e.g. "italian restaurant", "bakery". */
  businessHint?: string;
}): Promise<string> {
  const { uploadImage } = await import("./upload");
  const name = args.item.name.trim();
  const desc = args.item.description?.trim();
  const hint = args.businessHint?.trim();
  const subject = desc ? `${name} — ${desc}` : name;
  const extra = hint ? `Style cue: this is a ${hint}.` : undefined;
  const result = await enhanceImage({
    apiKey: args.openaiApiKey,
    kind: "item",
    subject,
    extra,
  });
  return uploadImage(args.slug, result.file, "items");
}

/**
 * Generate a hero banner from text only (no reference photos). Returns the
 * URL after uploadImage. Caller writes to Restaurant.heroImageUrl.
 */
export async function generateHeroForBusiness(args: {
  slug: string;
  openaiApiKey: string;
  businessName: string;
  /** Free-form hint about what kind of business this is. */
  businessHint?: string;
}): Promise<string> {
  const { uploadImage } = await import("./upload");
  const hint = args.businessHint?.trim();
  const result = await enhanceImage({
    apiKey: args.openaiApiKey,
    kind: "hero",
    subject: args.businessName,
    extra: hint
      ? `This is a ${hint}. Photograph the space or signature offering in a way that fits that vibe.`
      : undefined,
  });
  return uploadImage(args.slug, result.file, "hero");
}

/**
 * Extract a human message from an OpenAI error body if present. Falls back
 * to the raw status text.
 */
export function describeImageError(e: unknown): string {
  if (e instanceof ImageGenError) {
    const body = e.body as { error?: { message?: string; code?: string } } | undefined;
    if (body?.error?.message) return body.error.message;
    return e.message;
  }
  return e instanceof Error ? e.message : "Image generation failed";
}
