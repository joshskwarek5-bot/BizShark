"use server";

import { z } from "zod";
import { requireRestaurantAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncBillingForRestaurant } from "@/app/app/clients/[slug]/billing/actions";

/**
 * Client-side sync: the restaurant_admin can pull the latest invoice
 * statuses from the operator's Stripe so a freshly-paid invoice flips
 * to "paid" without needing the operator to click anything.
 */
export async function clientSyncBilling(input: { slug: string }) {
  const { slug } = z.object({ slug: z.string() }).parse(input);
  const auth = await requireRestaurantAdmin(slug);
  if (!auth.authorized) {
    return { ok: false as const, error: "Not authorized" };
  }
  return await syncBillingForRestaurant(auth.restaurant.id, undefined, slug);
}

/**
 * Fetch the latest hosted_invoice_url right now and open it. Some Stripe
 * hosted URLs eventually expire; this re-pulls a fresh one before
 * redirecting the client. Returns the URL — the caller does the navigation.
 */
export async function clientGetPayLink(input: { slug: string; invoiceLocalId: string }) {
  const { slug, invoiceLocalId } = z
    .object({ slug: z.string(), invoiceLocalId: z.string() })
    .parse(input);
  const auth = await requireRestaurantAdmin(slug);
  if (!auth.authorized) return { ok: false as const, error: "Not authorized" };
  const inv = await db.clientInvoice.findUnique({ where: { id: invoiceLocalId } });
  if (!inv || inv.restaurantId !== auth.restaurant.id) {
    return { ok: false as const, error: "Not found" };
  }
  if (!inv.hostedUrl) {
    return { ok: false as const, error: "No payment link on file yet — ask your provider." };
  }
  return { ok: true as const, url: inv.hostedUrl };
}
