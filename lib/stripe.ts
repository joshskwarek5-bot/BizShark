import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeNotConfiguredError(
      "Stripe is not configured. Add STRIPE_SECRET_KEY to .env to enable payments."
    );
  }
  cached = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "BizShark",
      version: "0.1.0",
    },
  });
  return cached;
}

export class StripeNotConfiguredError extends Error {}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Public publishable key surfaced to the client. */
export function publishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;
}

/** Best-effort base URL for redirect URLs from server context. */
export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export interface StripeAccountState {
  id: string;
  status: "none" | "pending" | "active" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

/**
 * Derive a simple state label from Stripe's account flags.
 *  - active:     charges_enabled === true && details_submitted === true
 *  - pending:    details_submitted is false (still onboarding)
 *  - restricted: details_submitted true but charges_enabled false (Stripe wants more info)
 */
export function deriveAccountState(account: Stripe.Account): StripeAccountState {
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  let status: StripeAccountState["status"];
  if (chargesEnabled && account.details_submitted) status = "active";
  else if (!account.details_submitted) status = "pending";
  else status = "restricted";
  return {
    id: account.id,
    status,
    chargesEnabled,
    payoutsEnabled,
  };
}
