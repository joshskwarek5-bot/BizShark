// Operator → client billing definitions. Distinct from the platform's
// Stripe (which charges operators) — this is the operator using THEIR own
// Stripe account to charge THEIR clients.

import Stripe from "stripe";

export const BILLING_MODES = ["revenue_share", "one_time", "monthly"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export interface BillingModeMeta {
  id: BillingMode;
  label: string;
  description: string;
  /** True if the operator can generate Stripe Invoices for this mode. */
  generatesInvoices: boolean;
}

export const BILLING_MODE_META: Record<BillingMode, BillingModeMeta> = {
  revenue_share: {
    id: "revenue_share",
    label: "% of sales",
    description:
      "Take a percentage of what the restaurant earns through online orders. You invoice them monthly based on order volume — we show the totals.",
    generatesInvoices: false,
  },
  one_time: {
    id: "one_time",
    label: "One-time fee",
    description:
      "Charge once for the site build. Stripe emails the client a hosted invoice with a Pay button. Money lands in your account.",
    generatesInvoices: true,
  },
  monthly: {
    id: "monthly",
    label: "Monthly fee",
    description:
      "Recurring monthly maintenance charge. Stripe subscribes the client and charges them automatically each month.",
    generatesInvoices: true,
  },
};

export function billingModeMeta(mode: string | null | undefined): BillingModeMeta | null {
  if (!mode || !(mode in BILLING_MODE_META)) return null;
  return BILLING_MODE_META[mode as BillingMode];
}

/**
 * Construct a Stripe client from an operator's BYO Secret Key.
 * Throws if the key is missing.
 */
export function operatorStripe(secretKey: string | null | undefined): Stripe {
  if (!secretKey) {
    throw new Error("Operator has not connected a Stripe account yet.");
  }
  return new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
    appInfo: { name: "Restaurant Platform — operator bills client", version: "0.1.0" },
  });
}

/**
 * Resolve the Stripe Customer for this client billing (operator's Stripe).
 * Creates one if missing. Returns the customer id.
 */
export async function ensureClientCustomer(
  stripe: Stripe,
  billing: {
    stripeCustomerId: string | null;
    clientBillingEmail: string | null;
    clientBillingName: string | null;
  },
  fallback: { name: string; email: string | null; phone: string | null }
): Promise<string> {
  if (billing.stripeCustomerId) {
    // Verify it still exists; if Stripe says deleted, fall through
    try {
      const c = await stripe.customers.retrieve(billing.stripeCustomerId);
      if (c && !("deleted" in c && c.deleted)) return billing.stripeCustomerId;
    } catch {
      /* fall through to create */
    }
  }
  const customer = await stripe.customers.create({
    email: billing.clientBillingEmail ?? fallback.email ?? undefined,
    name: billing.clientBillingName ?? fallback.name,
    phone: fallback.phone ?? undefined,
    metadata: { source: "operator_bills_client" },
  });
  return customer.id;
}

/**
 * Map a Stripe Invoice status to our compact set.
 */
export function mapInvoiceStatus(s: Stripe.Invoice.Status | null | undefined): string {
  if (!s) return "draft";
  switch (s) {
    case "paid":
      return "paid";
    case "open":
      return "open";
    case "void":
      return "void";
    case "uncollectible":
      return "uncollectible";
    case "draft":
    default:
      return "draft";
  }
}
