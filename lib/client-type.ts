// Backwards-compat shim. New code should use lib/business-types.ts directly.
// This file expands the original 2-type surface (restaurant | service_business)
// into the full taxonomy while keeping the existing API surface intact:
//   - CLIENT_TYPES (array of valid type strings)
//   - clientTypeMeta(type) → ClientTypeMeta { hasMenu, hasOrdering, hasServices, ... }
//
// Older callers can keep using `if (meta.hasMenu)`; new callers should pull
// FeatureMeta + isEnabled() from features.ts for finer-grained checks.

import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_META,
  type BusinessType,
} from "./business-types";
import { effectiveFeatures } from "./features";

export const CLIENT_TYPES = BUSINESS_TYPES;
export type ClientType = BusinessType;

export interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  priceCents?: number | null;
  duration?: string | null;
}

export function parseServices(json: string | null | undefined): ServiceItem[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is ServiceItem =>
          typeof x === "object" && x !== null && typeof x.name === "string"
      )
      .map((s) => ({
        id: typeof s.id === "string" ? s.id : Math.random().toString(36).slice(2, 10),
        name: s.name,
        description: typeof s.description === "string" ? s.description : undefined,
        priceCents:
          typeof s.priceCents === "number" && Number.isFinite(s.priceCents)
            ? s.priceCents
            : null,
        duration: typeof s.duration === "string" ? s.duration : null,
      }));
  } catch {
    return [];
  }
}

export interface ClientTypeMeta {
  key: ClientType;
  label: string;
  description: string;
  /** True for types whose default feature set includes a menu. */
  hasMenu: boolean;
  /** True for types whose default feature set includes online_ordering. */
  hasOrdering: boolean;
  /** True for types whose default feature set includes services_list. */
  hasServices: boolean;
  primaryCta: string;
}

/**
 * Resolve a type meta for a given type string. Falls back to the
 * restaurant meta for null/unknown values (matches the legacy behavior).
 */
export function clientTypeMeta(type: string | null | undefined): ClientTypeMeta {
  if (!type || !(BUSINESS_TYPES as readonly string[]).includes(type)) {
    return derive("restaurant");
  }
  return derive(type as BusinessType);
}

function derive(type: BusinessType): ClientTypeMeta {
  const t = BUSINESS_TYPE_META[type];
  // Use the type's default feature set to compute legacy boolean flags.
  // Once a restaurant has saved an explicit enabledFeatures list, callers
  // should prefer isEnabled()/hasFeature() — these booleans reflect the
  // type's default state only.
  const features = effectiveFeatures(type, null);
  return {
    key: type,
    label: t.label,
    description: t.description,
    hasMenu: features.has("menu"),
    hasOrdering: features.has("online_ordering"),
    hasServices: features.has("services_list"),
    primaryCta: t.primaryCta,
  };
}

/**
 * Per-restaurant variant: respects the restaurant's enabledFeatures (if
 * explicitly set) rather than just the type defaults. Use this anywhere
 * you have access to the restaurant row and want accurate gating.
 */
export function clientTypeMetaFor(
  type: string | null | undefined,
  enabledFeatures: string | null | undefined
): ClientTypeMeta {
  const resolved =
    type && (BUSINESS_TYPES as readonly string[]).includes(type)
      ? (type as BusinessType)
      : "restaurant";
  const t = BUSINESS_TYPE_META[resolved];
  const features = effectiveFeatures(resolved, enabledFeatures);
  return {
    key: resolved,
    label: t.label,
    description: t.description,
    hasMenu: features.has("menu"),
    hasOrdering: features.has("online_ordering"),
    hasServices: features.has("services_list"),
    primaryCta: t.primaryCta,
  };
}

/** Map of type → meta. Backwards-compat export. */
export const CLIENT_TYPE_META = Object.fromEntries(
  BUSINESS_TYPES.map((t) => [t, derive(t)])
) as Record<ClientType, ClientTypeMeta>;
