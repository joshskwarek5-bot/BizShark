// Merge fields available for outreach templates. Listed here so the
// template editor UI can surface them and the renderer can substitute.

export const MERGE_FIELDS = [
  { token: "businessName", label: "Business name" },
  { token: "businessType", label: "Business type" },
  { token: "city", label: "City" },
  { token: "state", label: "State" },
  { token: "address", label: "Address" },
  { token: "phone", label: "Business phone" },
  { token: "rating", label: "Google rating" },
  { token: "ownerName", label: "Owner name (if known)" },
  { token: "operatorName", label: "Your name" },
  { token: "operatorBusinessName", label: "Your agency name" },
  { token: "operatorPhone", label: "Your pitch phone" },
  { token: "previewUrl", label: "Site preview URL" },
] as const;

export type MergeFieldToken = (typeof MERGE_FIELDS)[number]["token"];
export type MergeVars = Partial<Record<MergeFieldToken, string | null | undefined>>;

export const TEMPLATE_KINDS = ["email", "sms", "script", "voicemail"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export function templateKindLabel(k: string): string {
  switch (k) {
    case "email":
      return "Email";
    case "sms":
      return "Text / SMS";
    case "script":
      return "Phone / in-person script";
    case "voicemail":
      return "Voicemail script";
    default:
      return k;
  }
}

/**
 * Substitute {{token}} → value. Unknown tokens are left in place so the
 * operator can spot them in the rendered output. Whitespace tolerant.
 */
export function fillTemplate(text: string, vars: MergeVars): string {
  return text.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, name: string) => {
    const v = (vars as Record<string, unknown>)[name];
    if (v === undefined || v === null || v === "") return match; // leave the token visible
    return String(v);
  });
}

/** Detect which merge fields a template actually uses. */
export function tokensInTemplate(text: string): string[] {
  const seen = new Set<string>();
  const re = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) seen.add(m[1]);
  return [...seen];
}
