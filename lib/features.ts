// Feature module system. Each Restaurant has an `enabledFeatures` list
// (JSON array of these keys) controlling what shows on the public site
// AND what tabs appear in the admin.
//
// The `applicableTo` array gates which business types can even see the
// toggle — e.g. "menu" is restaurant-only. Everything else is broadly
// applicable.

import { BUSINESS_TYPES, BUSINESS_TYPE_META, type BusinessType } from "./business-types";

export const FEATURE_KEYS = [
  "menu",
  "online_ordering",
  "services_list",
  "quote_request",
  "appointment_request",
  "gallery",
  "testimonials",
  "contact_form",
  "hours",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureMeta {
  key: FeatureKey;
  /** Operator-facing label in the toggle UI. */
  label: string;
  /** One-line description in the toggle UI. */
  description: string;
  /** Business types that can use this feature. */
  applicableTo: readonly BusinessType[];
  /** Other features that MUST also be on for this to work. */
  requires?: FeatureKey[];
  /** True when this feature isn't user-toggleable (always-on for the type). */
  alwaysOn?: boolean;
}

const ALL_TYPES = BUSINESS_TYPES;

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  menu: {
    key: "menu",
    label: "Menu",
    description: "Browseable menu with categories, prices, and item descriptions.",
    applicableTo: ["restaurant"],
  },
  online_ordering: {
    key: "online_ordering",
    label: "Online ordering",
    description: "Cart, checkout, kitchen queue. Requires Menu + Stripe Connect.",
    applicableTo: ["restaurant"],
    requires: ["menu"],
  },
  services_list: {
    key: "services_list",
    label: "Services",
    description: "Named services with optional pricing + duration.",
    applicableTo: [
      "trade_service",
      "personal_service",
      "professional_service",
      "healthcare",
      "fitness",
      "service_business",
    ],
  },
  quote_request: {
    key: "quote_request",
    label: "Quote request form",
    description:
      "Visitors describe their job and request a free quote. Submissions show up in Inquiries.",
    applicableTo: [
      "trade_service",
      "professional_service",
      "service_business",
      "retail",
    ],
  },
  appointment_request: {
    key: "appointment_request",
    label: "Appointment request",
    description:
      "Visitors pick a preferred date/time + service. You confirm by phone/email.",
    applicableTo: [
      "personal_service",
      "healthcare",
      "fitness",
      "professional_service",
      "service_business",
    ],
  },
  gallery: {
    key: "gallery",
    label: "Photo gallery",
    description: "Show off the space, work samples, or product shots.",
    applicableTo: ALL_TYPES,
  },
  testimonials: {
    key: "testimonials",
    label: "Testimonials",
    description: "Manually-curated customer quotes/reviews.",
    applicableTo: ALL_TYPES,
  },
  contact_form: {
    key: "contact_form",
    label: "Contact form",
    description: "Generic 'send us a message' form. Always a safe fallback.",
    applicableTo: ALL_TYPES,
  },
  hours: {
    key: "hours",
    label: "Hours",
    description: "Open/closed status + the weekly hours table.",
    applicableTo: ALL_TYPES,
    alwaysOn: true,
  },
};

export function featureMeta(key: string): FeatureMeta | null {
  if ((FEATURE_KEYS as readonly string[]).includes(key)) {
    return FEATURE_META[key as FeatureKey];
  }
  return null;
}

/** Parse the enabledFeatures JSON column into a typed set. */
export function parseEnabledFeatures(
  json: string | null | undefined
): Set<FeatureKey> {
  if (!json) return new Set();
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return new Set();
    const valid: FeatureKey[] = [];
    for (const item of arr) {
      if (typeof item === "string" && (FEATURE_KEYS as readonly string[]).includes(item)) {
        valid.push(item as FeatureKey);
      }
    }
    return new Set(valid);
  } catch {
    return new Set();
  }
}

export function isEnabled(
  enabledFeatures: string | null | undefined,
  key: FeatureKey
): boolean {
  return parseEnabledFeatures(enabledFeatures).has(key);
}

/**
 * Resolve the effective feature set for a restaurant: if it has an explicit
 * list, use that; otherwise fall back to the type's defaults. Existing rows
 * that predate the toggle system have `enabledFeatures = "[]"` — they get
 * the type defaults until the operator/admin explicitly saves a set.
 */
export function effectiveFeatures(
  type: BusinessType,
  enabledFeatures: string | null | undefined
): Set<FeatureKey> {
  const parsed = parseEnabledFeatures(enabledFeatures);
  if (parsed.size > 0) return parsed;
  return new Set(BUSINESS_TYPE_META[type].defaultFeatures);
}

export function effectiveFeatureList(
  type: BusinessType,
  enabledFeatures: string | null | undefined
): FeatureKey[] {
  return Array.from(effectiveFeatures(type, enabledFeatures));
}

export function hasFeature(
  type: BusinessType,
  enabledFeatures: string | null | undefined,
  key: FeatureKey
): boolean {
  return effectiveFeatures(type, enabledFeatures).has(key);
}

/** Stringify a set/array back to the JSON column shape. */
export function serializeFeatures(
  features: Iterable<FeatureKey>
): string {
  return JSON.stringify(Array.from(new Set(features)));
}

/**
 * Validate a feature set against a business type:
 *  - drops features that can't apply to the type
 *  - enforces requires (e.g. online_ordering needs menu)
 *  - ensures always-on features are present
 */
export function normalizeFeatures(
  type: BusinessType,
  raw: Iterable<FeatureKey>
): FeatureKey[] {
  const set = new Set<FeatureKey>();
  for (const f of raw) {
    const meta = FEATURE_META[f];
    if (!meta) continue;
    if (!meta.applicableTo.includes(type)) continue;
    set.add(f);
  }
  // Add always-on features for this type
  for (const f of FEATURE_KEYS) {
    const meta = FEATURE_META[f];
    if (meta.alwaysOn && meta.applicableTo.includes(type)) set.add(f);
  }
  // Resolve requires — if A requires B and A is on, B must be on too
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of Array.from(set)) {
      const meta = FEATURE_META[f];
      for (const dep of meta.requires ?? []) {
        if (!set.has(dep)) {
          set.add(dep);
          changed = true;
        }
      }
    }
  }
  return Array.from(set);
}
