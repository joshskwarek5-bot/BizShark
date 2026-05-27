// Subscription tier definitions — drives the marketing page, billing UI,
// and feature gates. Tiers are platform-level (the SaaS billing operators).
// Distinct from operator-to-client billing (Phase 9).

export const TIER_IDS = ["starter", "pro", "agency"] as const;
export type TierId = (typeof TIER_IDS)[number];

export interface TierDefinition {
  id: TierId;
  name: string;
  priceMonthly: number; // dollars
  blurb: string;
  /**
   * Max number of stored leads in the operator's CRM at any time. New
   * searches refuse to save beyond this. Deleting old leads frees capacity.
   * Drives the upgrade-to-find-more UX.
   */
  maxLeads: number;
  /** Max simultaneous client restaurants. null = unlimited. */
  maxClients: number | null;
  /** Highlighted features for the pricing card. */
  features: string[];
  /** Stripe Price ID — read from env at runtime, listed here as the env name. */
  envPriceVar: string;
  featured?: boolean;
}

export const TIERS: Record<TierId, TierDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 49,
    blurb: "Get your first client in the door",
    maxLeads: 15,
    maxClients: 3,
    features: [
      "15 saved leads at a time",
      "Up to 3 client sites",
      "All website templates",
      "AI-assisted copy + menu import",
      "Email + script templates",
    ],
    envPriceVar: "STRIPE_PRICE_STARTER",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 149,
    blurb: "Most popular for full-time operators",
    maxLeads: 50,
    maxClients: null,
    features: [
      "50 saved leads at a time",
      "Unlimited client sites",
      "Custom outreach templates",
      "Online ordering + Stripe Connect",
      "Bill clients (% / one-time / monthly)",
      "Priority support",
    ],
    envPriceVar: "STRIPE_PRICE_PRO",
    featured: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthly: 497,
    blurb: "For multi-person operations",
    maxLeads: 250,
    maxClients: null,
    features: [
      "250 saved leads at a time",
      "Unlimited everything",
      "White-label (your own domain)",
      "Team seats",
      "Custom templates on request",
      "1:1 onboarding call",
    ],
    envPriceVar: "STRIPE_PRICE_AGENCY",
  },
};

export function getTier(id: string | null | undefined): TierDefinition {
  if (id && (id as TierId) in TIERS) return TIERS[id as TierId];
  return TIERS.starter;
}

export function tierFromPriceId(priceId: string | null | undefined): TierId | null {
  if (!priceId) return null;
  for (const tier of Object.values(TIERS)) {
    if (process.env[tier.envPriceVar] === priceId) return tier.id;
  }
  return null;
}

export function getStripePriceId(tier: TierId): string | null {
  return process.env[TIERS[tier].envPriceVar] ?? null;
}

/** Whether the platform has Stripe Billing fully configured (all price IDs set). */
export function isBillingConfigured(): boolean {
  return TIER_IDS.every((id) => Boolean(process.env[TIERS[id].envPriceVar]));
}

/**
 * Capacity snapshot for the operator's lead inventory — drives the live
 * counter + upgrade CTA in the lead pipeline UI.
 */
export interface LeadCapacity {
  used: number;
  cap: number;
  remaining: number;
  /** percent used, clamped 0..100 */
  pct: number;
  /** UX states for color/badge tone */
  state: "ok" | "warning" | "full";
}

export function computeLeadCapacity(used: number, cap: number): LeadCapacity {
  const remaining = Math.max(0, cap - used);
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const state: LeadCapacity["state"] =
    used >= cap ? "full" : pct >= 80 ? "warning" : "ok";
  return { used, cap, remaining, pct, state };
}

/**
 * Returns the effective access window — operator has access if status is
 * trial/active OR they canceled but are still within the paid period.
 */
export function hasActiveAccess(operator: {
  subscriptionStatus: string;
  trialEndsAt?: Date | null;
  subscriptionCurrentPeriodEnd?: Date | null;
}): boolean {
  const now = new Date();
  if (operator.subscriptionStatus === "trial") {
    return operator.trialEndsAt ? operator.trialEndsAt > now : true;
  }
  if (operator.subscriptionStatus === "active") return true;
  if (operator.subscriptionStatus === "past_due") return true; // grace period
  if (
    operator.subscriptionStatus === "canceled" &&
    operator.subscriptionCurrentPeriodEnd &&
    operator.subscriptionCurrentPeriodEnd > now
  ) {
    return true;
  }
  return false;
}

/** How many days remain in trial (0 if trial ended or never set). */
export function trialDaysLeft(operator: {
  trialEndsAt?: Date | null;
}): number | null {
  if (!operator.trialEndsAt) return null;
  const ms = operator.trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
