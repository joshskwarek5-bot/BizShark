"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { appBaseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { getStripePriceId, isBillingConfigured, TIER_IDS, type TierId } from "@/lib/subscriptions";

export async function startTrialCheckout(
  input: { tier: TierId }
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { tier } = z.object({ tier: z.enum(TIER_IDS) }).parse(input);
  const auth = await requireOperator();
  if (!auth.authorized) return { ok: false, error: "Not authenticated" };
  const { operator } = auth;

  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe is not configured on this deployment." };
  }
  if (!isBillingConfigured()) {
    return { ok: false, error: "Billing prices are not configured yet." };
  }
  const priceId = getStripePriceId(tier);
  if (!priceId) {
    return { ok: false, error: `Price for ${tier} tier is not configured.` };
  }

  const stripe = getStripe();

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
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: operator.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 3,
      metadata: { operatorId: operator.id, tier },
    },
    payment_method_collection: "always",
    success_url: `${base}/start/complete`,
    cancel_url: `${base}/start?checkout=canceled`,
    billing_address_collection: "auto",
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return { ok: false, error: "Stripe didn't return a checkout URL." };
  }
  return { ok: true, url: session.url };
}
