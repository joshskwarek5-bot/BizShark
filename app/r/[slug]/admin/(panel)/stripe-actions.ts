"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import {
  appBaseUrl,
  deriveAccountState,
  getStripe,
  isStripeConfigured,
  StripeNotConfiguredError,
} from "@/lib/stripe";

async function ensureAuth(slug: string) {
  const res = await requireRestaurantAdmin(slug);
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

/**
 * Creates an Express account if one doesn't exist yet, then returns a fresh
 * AccountLink for hosted onboarding.
 */
export async function startStripeOnboarding(slug: string): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  const { restaurant } = await ensureAuth(slug);
  if (!isStripeConfigured()) {
    return {
      ok: false,
      error:
        "Stripe is not configured on this deployment. Add STRIPE_SECRET_KEY to .env to enable payments.",
    };
  }
  const stripe = getStripe();

  let accountId = restaurant.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: restaurant.email ?? undefined,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: restaurant.name,
        url: `${appBaseUrl()}/r/${restaurant.slug}`,
        support_phone: restaurant.phone,
        product_description: `Online ordering for ${restaurant.name}`,
        support_address: restaurant.address
          ? {
              line1: restaurant.address,
              city: restaurant.city ?? undefined,
              state: restaurant.state ?? undefined,
              postal_code: restaurant.zip ?? undefined,
              country: "US",
            }
          : undefined,
      },
      metadata: { restaurantId: restaurant.id, slug: restaurant.slug },
    });
    accountId = account.id;
    await db.restaurant.update({
      where: { id: restaurant.id },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: "pending",
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      },
    });
  }

  const base = appBaseUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/stripe/connect/refresh?slug=${slug}`,
    return_url: `${base}/api/stripe/connect/return?slug=${slug}`,
    type: "account_onboarding",
  });
  return { ok: true, url: link.url };
}

/**
 * Pulls the latest state from Stripe and writes it to the Restaurant row.
 * Called from the connect return route and any time we want to refresh.
 */
export async function refreshStripeStatus(slug: string): Promise<
  | { ok: true; status: string; chargesEnabled: boolean; payoutsEnabled: boolean }
  | { ok: false; error: string }
> {
  const { restaurant } = await ensureAuth(slug);
  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe not configured" };
  }
  if (!restaurant.stripeAccountId) {
    return { ok: false, error: "No Stripe account connected yet" };
  }
  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(restaurant.stripeAccountId);
    const state = deriveAccountState(account);
    await db.restaurant.update({
      where: { id: restaurant.id },
      data: {
        stripeAccountStatus: state.status,
        stripeChargesEnabled: state.chargesEnabled,
        stripePayoutsEnabled: state.payoutsEnabled,
      },
    });
    revalidatePath(`/r/${slug}/admin/settings`);
    revalidatePath(`/r/${slug}/checkout`);
    return {
      ok: true,
      status: state.status,
      chargesEnabled: state.chargesEnabled,
      payoutsEnabled: state.payoutsEnabled,
    };
  } catch (e) {
    console.error("[stripe] refresh failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}

/**
 * Generates a one-time login link to the Stripe Express dashboard so the
 * restaurant owner can view balances, payouts, and dispute info.
 */
export async function getStripeDashboardLink(slug: string): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  const { restaurant } = await ensureAuth(slug);
  if (!restaurant.stripeAccountId) return { ok: false, error: "Not connected" };
  try {
    const stripe = getStripe();
    const link = await stripe.accounts.createLoginLink(restaurant.stripeAccountId);
    return { ok: true, url: link.url };
  } catch (e) {
    if (e instanceof StripeNotConfiguredError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not create link" };
  }
}

/**
 * Disconnects Stripe by clearing the local fields. We deliberately do NOT
 * call stripe.accounts.del() because the restaurant may want to reconnect
 * the same account later, and it preserves payout history on Stripe's side.
 */
export async function disconnectStripe(slug: string) {
  const { restaurant } = await ensureAuth(slug);
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      stripeAccountId: null,
      stripeAccountStatus: "none",
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
    },
  });
  revalidatePath(`/r/${slug}/admin/settings`);
  revalidatePath(`/r/${slug}/checkout`);
  return { ok: true as const };
}

/**
 * Super-admin-only: set the platform fee in basis points (100 = 1%).
 * Restaurant admins shouldn't be able to set their own platform fee.
 */
export async function setPlatformFee(input: { slug: string; bps: number }) {
  const { slug, bps } = z
    .object({ slug: z.string(), bps: z.number().int().min(0).max(2500) })
    .parse(input);
  const auth = await requireRestaurantAdmin(slug);
  if (!auth.authorized) throw new Error(auth.reason);
  if (auth.session.role !== "super_admin") {
    return { ok: false as const, error: "Only platform admins can set platform fees" };
  }
  await db.restaurant.update({
    where: { id: auth.restaurant.id },
    data: { platformFeeBps: bps },
  });
  revalidatePath(`/r/${slug}/admin/settings`);
  return { ok: true as const };
}
