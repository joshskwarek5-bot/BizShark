"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import {
  appBaseUrl,
  getStripe,
  isStripeConfigured,
  StripeNotConfiguredError,
} from "@/lib/stripe";
import { getStripePriceId, isBillingConfigured, TIER_IDS, type TierId } from "@/lib/subscriptions";

async function ensureOperator() {
  const res = await requireOperator();
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

/**
 * Create a Stripe Checkout Session for the operator to subscribe to the
 * given tier. Returns the URL — caller redirects the browser to it.
 *
 * If the operator already has a Stripe Customer (from a prior subscription),
 * we reuse it so their payment methods / address carry over.
 */
export async function startSubscriptionCheckout(input: { tier: TierId }) {
  const { tier } = z.object({ tier: z.enum(TIER_IDS) }).parse(input);
  const { operator } = await ensureOperator();

  if (!isStripeConfigured()) {
    return {
      ok: false as const,
      error: "Stripe is not configured on this deployment.",
    };
  }
  if (!isBillingConfigured()) {
    return {
      ok: false as const,
      error:
        "Subscription billing isn't configured. The platform admin needs to set STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, and STRIPE_PRICE_AGENCY.",
    };
  }
  const priceId = getStripePriceId(tier);
  if (!priceId) {
    return { ok: false as const, error: `Stripe price for ${tier} tier is not configured` };
  }

  const stripe = getStripe();

  // Ensure we have a Customer to attach the subscription to
  let customerId = operator.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: operator.email,
      name: operator.businessName ?? operator.name ?? undefined,
      metadata: { operatorId: operator.id },
    });
    customerId = customer.id;
    await db.operator.update({
      where: { id: operator.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const base = appBaseUrl();
  // If the operator's still in trial, Stripe's free-trial logic doesn't kick
  // in because we're not putting them on subscription_data.trial_period_days —
  // we already gave them a trial in our app. They're upgrading mid-trial.
  // For simplicity we charge immediately and end the local trial.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/app/billing?checkout=success`,
    cancel_url: `${base}/app/billing?checkout=canceled`,
    billing_address_collection: "auto",
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { operatorId: operator.id, tier },
    },
  });

  if (!session.url) {
    return { ok: false as const, error: "Stripe didn't return a checkout URL" };
  }
  return { ok: true as const, url: session.url };
}

/**
 * Mint a one-time login link to the Stripe Customer Portal so the operator
 * can update payment method, swap plans, view invoices, or cancel.
 */
export async function openCustomerPortal(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const { operator } = await ensureOperator();
  if (!operator.stripeCustomerId) {
    return { ok: false, error: "No Stripe customer yet — start a subscription first." };
  }
  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: operator.stripeCustomerId,
      return_url: `${appBaseUrl()}/app/billing`,
    });
    return { ok: true, url: session.url };
  } catch (e) {
    if (e instanceof StripeNotConfiguredError) return { ok: false, error: e.message };
    const msg = e instanceof Error ? e.message : "Could not open portal";
    return { ok: false, error: msg };
  }
}

/**
 * Pull the current state from Stripe and reconcile to the local Operator row.
 * Called from the billing page on return from Checkout.
 */
export async function refreshSubscriptionStatus() {
  const { operator } = await ensureOperator();
  if (!operator.stripeCustomerId || !isStripeConfigured()) {
    return { ok: false as const, error: "No customer to refresh" };
  }
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: operator.stripeCustomerId,
    status: "all",
    limit: 1,
  });
  const sub = subs.data[0];
  if (!sub) return { ok: true as const, status: "none" };

  const priceId = sub.items.data[0]?.price.id ?? null;
  const { tierFromPriceId } = await import("@/lib/subscriptions");
  const tier = tierFromPriceId(priceId) ?? operator.subscriptionTier;

  const periodEnd = sub.items.data[0]?.current_period_end ?? 0;
  await db.operator.update({
    where: { id: operator.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: mapStripeStatus(sub.status),
      subscriptionTier: tier,
      subscriptionCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      subscriptionCancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      subscriptionCanceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
  });
  return { ok: true as const, status: sub.status };
}

function mapStripeStatus(s: string): string {
  // Map Stripe subscription statuses to our compact set
  switch (s) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
      return "past_due";
    default:
      return s;
  }
}
