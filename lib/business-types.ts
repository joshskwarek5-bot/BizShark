// Business type taxonomy + per-type feature defaults.
//
// Each Restaurant row has a `type` (one of these keys). The type drives:
//   1) which features are available (e.g. menu only for restaurants),
//   2) sensible default-enabled features when the restaurant is created,
//   3) which AI prompt template the create flow uses,
//   4) which icons/labels are shown across the operator UI.
//
// Adding a new type? Add the key here + entry in BUSINESS_TYPE_META below.
// `client-type.ts` is the older 2-type surface — kept as a shim during the
// migration; new code should use this file.

import type { FeatureKey } from "./features";

export const BUSINESS_TYPES = [
  "restaurant",
  "trade_service",
  "personal_service",
  "professional_service",
  "healthcare",
  "fitness",
  "retail",
  "service_business",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface BusinessTypeMeta {
  key: BusinessType;
  /** Operator-facing label shown in the type picker. */
  label: string;
  /** One-line summary for the type picker. */
  description: string;
  /** Common examples — used in placeholder text + tooltips. */
  examples: string[];
  /** Default features enabled when a new client of this type is created. */
  defaultFeatures: FeatureKey[];
  /** True when this type uses the menu/ordering pipeline. */
  hasMenu: boolean;
  /** True when this type uses a structured services list. */
  hasServices: boolean;
  /** Primary CTA shown on the public landing hero. */
  primaryCta: string;
}

export const BUSINESS_TYPE_META: Record<BusinessType, BusinessTypeMeta> = {
  restaurant: {
    key: "restaurant",
    label: "Restaurant / Cafe / Bar",
    description: "Menu, online ordering, kitchen queue.",
    examples: ["Restaurant", "Cafe", "Bar", "Bakery", "Brewery"],
    defaultFeatures: ["menu", "online_ordering", "hours", "contact_form"],
    hasMenu: true,
    hasServices: false,
    primaryCta: "Order online",
  },
  trade_service: {
    key: "trade_service",
    label: "Home / Trade Services",
    description: "Free quotes, service area, on-call emergencies.",
    examples: ["HVAC", "Plumber", "Electrician", "Landscaper", "Auto repair", "Roofer"],
    defaultFeatures: [
      "services_list",
      "quote_request",
      "hours",
      "gallery",
      "testimonials",
    ],
    hasMenu: false,
    hasServices: true,
    primaryCta: "Get a free quote",
  },
  personal_service: {
    key: "personal_service",
    label: "Salon / Spa / Personal Service",
    description: "Service menu with prices + appointment requests.",
    examples: ["Hair salon", "Barber", "Nail salon", "Spa", "Massage"],
    defaultFeatures: [
      "services_list",
      "appointment_request",
      "hours",
      "gallery",
      "testimonials",
    ],
    hasMenu: false,
    hasServices: true,
    primaryCta: "Book an appointment",
  },
  professional_service: {
    key: "professional_service",
    label: "Professional Services",
    description: "Consultation request, practice areas, credibility signals.",
    examples: ["Law firm", "Accountant", "Real estate", "Consultant", "Insurance"],
    defaultFeatures: [
      "services_list",
      "quote_request",
      "hours",
      "testimonials",
      "contact_form",
    ],
    hasMenu: false,
    hasServices: true,
    primaryCta: "Book a consultation",
  },
  healthcare: {
    key: "healthcare",
    label: "Healthcare / Wellness",
    description: "Appointment requests, services + insurance/pricing.",
    examples: ["Dentist", "Doctor", "Chiropractor", "Vet", "Optometrist", "Therapist"],
    defaultFeatures: [
      "services_list",
      "appointment_request",
      "hours",
      "contact_form",
      "testimonials",
    ],
    hasMenu: false,
    hasServices: true,
    primaryCta: "Request an appointment",
  },
  fitness: {
    key: "fitness",
    label: "Fitness / Studio",
    description: "Class schedule, trial signups, member services.",
    examples: ["Gym", "Yoga studio", "Pilates", "Dance", "Martial arts", "CrossFit"],
    defaultFeatures: [
      "services_list",
      "appointment_request",
      "hours",
      "gallery",
      "testimonials",
    ],
    hasMenu: false,
    hasServices: true,
    primaryCta: "Book a class",
  },
  retail: {
    key: "retail",
    label: "Retail / Boutique",
    description: "Storefront site with hours, gallery, contact.",
    examples: ["Boutique", "Florist", "Bookstore", "Gift shop", "Antique store"],
    defaultFeatures: ["hours", "gallery", "contact_form", "testimonials"],
    hasMenu: false,
    hasServices: false,
    primaryCta: "Visit us",
  },
  service_business: {
    key: "service_business",
    label: "Other service business",
    description: "Generic services + contact (catch-all).",
    examples: ["Cleaner", "Tutor", "Photographer", "Other"],
    defaultFeatures: ["services_list", "contact_form", "hours"],
    hasMenu: false,
    hasServices: true,
    primaryCta: "Get in touch",
  },
};

export function businessTypeMeta(type: string | null | undefined): BusinessTypeMeta {
  if (!type) return BUSINESS_TYPE_META.restaurant;
  if ((BUSINESS_TYPES as readonly string[]).includes(type)) {
    return BUSINESS_TYPE_META[type as BusinessType];
  }
  return BUSINESS_TYPE_META.service_business;
}

/**
 * Best-guess business type from a free-form category string (e.g. the
 * primary_type Google Places returns). Used during lead conversion to
 * preselect a type. Falls back to restaurant.
 */
export function guessBusinessType(input: string | null | undefined): BusinessType {
  if (!input) return "restaurant";
  const t = input.toLowerCase();

  // Check personal_service FIRST — "barber_shop" would otherwise match "bar".
  if (
    t.includes("salon") ||
    t.includes("barber") ||
    t.includes("spa") ||
    t.includes("nail") ||
    t.includes("massage") ||
    t.includes("waxing")
  ) {
    return "personal_service";
  }
  if (
    t.includes("restaurant") ||
    t.includes("cafe") ||
    t.includes("bar") ||
    t.includes("bakery") ||
    t.includes("pizza") ||
    t.includes("food") ||
    t.includes("coffee") ||
    t.includes("brewery") ||
    t.includes("diner")
  ) {
    return "restaurant";
  }
  if (
    t.includes("dentist") ||
    t.includes("dental") ||
    t.includes("doctor") ||
    t.includes("clinic") ||
    t.includes("vet") ||
    t.includes("chiro") ||
    t.includes("optom")
  ) {
    return "healthcare";
  }
  if (
    t.includes("gym") ||
    t.includes("fitness") ||
    t.includes("yoga") ||
    t.includes("pilates") ||
    t.includes("crossfit")
  ) {
    return "fitness";
  }
  if (
    t.includes("plumb") ||
    t.includes("hvac") ||
    t.includes("electric") ||
    t.includes("landscap") ||
    t.includes("repair") ||
    t.includes("contractor") ||
    t.includes("roofing") ||
    t.includes("auto")
  ) {
    return "trade_service";
  }
  if (
    t.includes("lawyer") ||
    t.includes("attorney") ||
    t.includes("law") ||
    t.includes("account") ||
    t.includes("real estate") ||
    t.includes("realtor") ||
    t.includes("insurance")
  ) {
    return "professional_service";
  }
  if (
    t.includes("shop") ||
    t.includes("boutique") ||
    t.includes("store") ||
    t.includes("florist") ||
    t.includes("retail")
  ) {
    return "retail";
  }
  return "service_business";
}
