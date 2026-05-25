export const CLIENT_TYPES = ["restaurant", "service_business"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

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
      .filter((x): x is ServiceItem => typeof x === "object" && x !== null && typeof x.name === "string")
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
  hasMenu: boolean;
  hasOrdering: boolean;
  hasServices: boolean;
  primaryCta: string;
}

export const CLIENT_TYPE_META: Record<ClientType, ClientTypeMeta> = {
  restaurant: {
    key: "restaurant",
    label: "Restaurant",
    description: "Menu, online ordering, kitchen-side admin queue.",
    hasMenu: true,
    hasOrdering: true,
    hasServices: false,
    primaryCta: "Order online",
  },
  service_business: {
    key: "service_business",
    label: "Service business",
    description: "Salon, gym, spa, contractor — services list + contact.",
    hasMenu: false,
    hasOrdering: false,
    hasServices: true,
    primaryCta: "Call to book",
  },
};

export function clientTypeMeta(type: string | null | undefined): ClientTypeMeta {
  if (type === "service_business") return CLIENT_TYPE_META.service_business;
  return CLIENT_TYPE_META.restaurant;
}
