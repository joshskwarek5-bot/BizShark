"use server";

// Operator-side Stripe Connect setup. Wraps the existing restaurant-admin
// flow (app/r/[slug]/admin/(panel)/stripe-actions.ts) but auth'd via
// requireOperator + ownership check, so an agency owner can spin up payments
// for any of their restaurants WITHOUT them needing to log in first.
//
// Two ways the operator can use the returned onboarding URL:
//   1. Open it themselves to complete onboarding on the restaurant's behalf
//      (fastest for the demo — they only need to add a bank account later)
//   2. Copy/email/SMS it to the restaurant owner so they finish it themselves
//
// Either way, when Stripe redirects back to /api/stripe/connect/return?slug=X
// the restaurant's stripeAccountStatus updates to active.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import {
  appBaseUrl,
  deriveAccountState,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";

async function ensureOwnedRestaurant(slug: string) {
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const r = await db.restaurant.findUnique({ where: { slug } });
  if (!r) throw new Error("not_found");
  if (r.operatorId !== auth.operator.id) throw new Error("forbidden");
  return { operator: auth.operator, restaurant: r };
}

/**
 * Create the Stripe Express account (if missing) and generate a fresh
 * AccountLink the operator can share with the restaurant owner. Idempotent —
 * calling twice just refreshes the link.
 */
export async function setupRestaurantStripe(input: { slug: string }): Promise<
  | {
      ok: true;
      url: string;
      accountId: string;
      status: string;
      isNew: boolean;
    }
  | { ok: false; error: string }
> {
  const { slug } = z.object({ slug: z.string() }).parse(input);
  let context;
  try {
    context = await ensureOwnedRestaurant(slug);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized" };
  }
  const { restaurant } = context;

  if (!isStripeConfigured()) {
    return {
      ok: false,
      error:
        "The platform isn't connected to Stripe yet. Set STRIPE_SECRET_KEY in .env.",
    };
  }

  const stripe = getStripe();
  let accountId = restaurant.stripeAccountId;
  let isNew = false;

  if (!accountId) {
    try {
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
        metadata: {
          restaurantId: restaurant.id,
          slug: restaurant.slug,
          createdByOperator: restaurant.operatorId ?? "",
          createdVia: "operator-setup",
        },
      });
      accountId = account.id;
      isNew = true;
      await db.restaurant.update({
        where: { id: restaurant.id },
        data: {
          stripeAccountId: account.id,
          stripeAccountStatus: "pending",
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
        },
      });
    } catch (e) {
      console.error("[operator-stripe] create account failed", e);
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Could not create Stripe account",
      };
    }
  }

  // Always generate a fresh AccountLink — they expire fast (a few minutes).
  try {
    const base = appBaseUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/api/stripe/connect/refresh?slug=${slug}`,
      return_url: `${base}/api/stripe/connect/return?slug=${slug}`,
      type: "account_onboarding",
    });
    return {
      ok: true,
      url: link.url,
      accountId,
      status: restaurant.stripeAccountStatus,
      isNew,
    };
  } catch (e) {
    console.error("[operator-stripe] account link failed", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not generate onboarding link",
    };
  }
}

/**
 * Pulls live Stripe state and reconciles the local row. Operator can hit
 * this anytime to verify if the owner finished onboarding.
 */
export async function refreshRestaurantStripe(input: { slug: string }): Promise<
  | {
      ok: true;
      status: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
    }
  | { ok: false; error: string }
> {
  const { slug } = z.object({ slug: z.string() }).parse(input);
  let context;
  try {
    context = await ensureOwnedRestaurant(slug);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized" };
  }
  const { restaurant } = context;

  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe not configured on this deployment" };
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
    revalidatePath(`/app/clients/${slug}`);
    revalidatePath(`/r/${slug}/admin/settings`);
    return {
      ok: true,
      status: state.status,
      chargesEnabled: state.chargesEnabled,
      payoutsEnabled: state.payoutsEnabled,
    };
  } catch (e) {
    console.error("[operator-stripe] refresh failed", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Refresh failed",
    };
  }
}

/**
 * Set the platform fee in basis points for THIS restaurant.
 * Operator-callable so the agency owner can decide their margin per client.
 * Range: 0-2500 bps (0%-25%).
 */
export async function setOperatorPlatformFee(input: {
  slug: string;
  bps: number;
}) {
  const { slug, bps } = z
    .object({ slug: z.string(), bps: z.number().int().min(0).max(2500) })
    .parse(input);
  let context;
  try {
    context = await ensureOwnedRestaurant(slug);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Not authorized",
    };
  }
  await db.restaurant.update({
    where: { id: context.restaurant.id },
    data: { platformFeeBps: bps },
  });
  revalidatePath(`/app/clients/${slug}`);
  return { ok: true as const };
}
