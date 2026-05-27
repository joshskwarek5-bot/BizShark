"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { canOrderNow } from "@/lib/ordering";
import { emitOrderEvent } from "@/lib/order-events";
import { appBaseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { sendOrderReceipt } from "@/lib/email";

const CartLineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
  notes: z.string().max(280).optional(),
});

const StartCardCheckoutSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().min(7).max(20),
  customerEmail: z.string().email().max(120).optional().or(z.literal("")),
  pickupTime: z.string().min(1).max(40),
  notes: z.string().max(500).optional(),
  tipCents: z.number().int().min(0).max(100000).default(0),
  lines: z.array(CartLineSchema).min(1),
});

export interface StartCardCheckoutResult {
  ok: boolean;
  orderId?: string;
  orderNumber?: number;
  clientSecret?: string;
  publishableKey?: string;
  stripeAccountId?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  unavailableNames?: string[];
}

/**
 * Creates an Order in pending-payment state and a Stripe PaymentIntent on
 * the restaurant's connected account. Returns the PI client_secret so the
 * customer can confirm payment from the browser.
 *
 * Order is committed to the DB before payment runs (paymentStatus="pending");
 * we filter pending-card orders out of the admin queue so the kitchen doesn't
 * see them until the webhook flips paymentStatus to "paid".
 */
export async function startCardCheckout(
  raw: z.input<typeof StartCardCheckoutSchema>
): Promise<StartCardCheckoutResult> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "Card payments are not available on this site right now." };
  }
  const parsed = StartCardCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  const restaurant = await db.restaurant.findUnique({ where: { slug: input.slug } });
  if (!restaurant || !restaurant.isActive) {
    return { ok: false, error: "This business is not accepting orders right now." };
  }

  const ordering = canOrderNow(restaurant);
  if (!ordering.ok) return { ok: false, error: ordering.message };

  if (!restaurant.stripeAccountId || !restaurant.stripeChargesEnabled) {
    return {
      ok: false,
      error:
        "Card payments aren't enabled yet for this restaurant. Choose Pay at pickup instead.",
    };
  }

  // Validate items + recompute pricing server-side
  const itemIds = input.lines.map((l) => l.itemId);
  const items = await db.menuItem.findMany({
    where: { id: { in: itemIds }, restaurantId: restaurant.id },
  });
  if (items.length !== itemIds.length) {
    return {
      ok: false,
      error: "Some items in your cart are no longer available. Refresh and try again.",
    };
  }
  const unavailable = items.filter((i) => !i.isAvailable);
  if (unavailable.length > 0) {
    return {
      ok: false,
      error: "Some items in your cart are currently unavailable.",
      unavailableNames: unavailable.map((i) => i.name),
    };
  }

  const lineMap = new Map(input.lines.map((l) => [l.itemId, l]));
  const orderItemsData = items.map((it) => {
    const cartLine = lineMap.get(it.id)!;
    return {
      menuItemId: it.id,
      name: it.name,
      priceCents: it.priceCents,
      quantity: cartLine.quantity,
      notes: cartLine.notes || null,
    };
  });

  const subtotalCents = orderItemsData.reduce(
    (acc, l) => acc + l.priceCents * l.quantity,
    0
  );
  const taxCents = Math.round((subtotalCents * restaurant.taxBps) / 10000);
  const tipCents = input.tipCents ?? 0;
  const totalCents = subtotalCents + taxCents + tipCents;
  const platformFeeCents = Math.round((totalCents * restaurant.platformFeeBps) / 10000);

  // Create the order first (lets us tie the PI back via metadata)
  const created = await db.$transaction(async (tx) => {
    const last = await tx.order.findFirst({
      where: { restaurantId: restaurant.id },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (last?.orderNumber ?? 0) + 1;
    return tx.order.create({
      data: {
        restaurantId: restaurant.id,
        orderNumber,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        customerEmail: input.customerEmail?.trim() || null,
        orderType: "pickup",
        pickupTime: input.pickupTime,
        notes: input.notes?.trim() || null,
        subtotalCents,
        taxCents,
        tipCents,
        totalCents,
        status: "new",
        paymentMethod: "card",
        paymentStatus: "pending",
        items: { create: orderItemsData },
      },
    });
  });

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency: "usd",
        // Lets Stripe show Apple Pay, Google Pay, Link, cards, etc.
        automatic_payment_methods: { enabled: true },
        application_fee_amount: platformFeeCents > 0 ? platformFeeCents : undefined,
        receipt_email: input.customerEmail?.trim() || undefined,
        description: `Order #${created.orderNumber} · ${restaurant.name}`,
        statement_descriptor_suffix: restaurant.name.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 22),
        metadata: {
          orderId: created.id,
          orderNumber: String(created.orderNumber),
          restaurantId: restaurant.id,
          restaurantSlug: restaurant.slug,
        },
      },
      { stripeAccount: restaurant.stripeAccountId }
    );

    await db.order.update({
      where: { id: created.id },
      data: { stripePaymentIntentId: intent.id },
    });

    return {
      ok: true,
      orderId: created.id,
      orderNumber: created.orderNumber,
      clientSecret: intent.client_secret ?? undefined,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? undefined,
      stripeAccountId: restaurant.stripeAccountId,
    };
  } catch (e) {
    // Roll back the half-created order so we don't pollute the queue
    await db.order
      .delete({ where: { id: created.id } })
      .catch(() => {});
    console.error("[stripe] PaymentIntent create failed", e);
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Could not start payment: ${e.message}`
          : "Could not start payment.",
    };
  }
}

/**
 * Called from the order confirmation page when the user lands back from
 * Stripe (return_url). Verifies the PI status with Stripe and flips the
 * Order to "paid" if Stripe says succeeded. The webhook covers the case
 * where the user closes their tab before the redirect.
 */
export async function reconcilePaymentForOrder(orderId: string): Promise<{
  ok: boolean;
  status?: string;
  error?: string;
}> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { restaurant: true },
  });
  if (!order) return { ok: false, error: "Order not found" };
  if (!order.stripePaymentIntentId) return { ok: true, status: order.paymentStatus };
  if (order.paymentStatus === "paid") return { ok: true, status: "paid" };

  if (!order.restaurant.stripeAccountId || !isStripeConfigured()) {
    return { ok: false, error: "Stripe not configured" };
  }

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, {
      stripeAccount: order.restaurant.stripeAccountId,
    });
    const next = mapPaymentStatus(intent.status);
    if (next !== order.paymentStatus) {
      const receiptUrl =
        intent.latest_charge && typeof intent.latest_charge !== "string"
          ? intent.latest_charge.receipt_url ?? null
          : null;
      await db.order.update({
        where: { id: order.id },
        data: { paymentStatus: next, stripeReceiptUrl: receiptUrl },
      });
      emitOrderEvent({
        kind: "updated",
        restaurantId: order.restaurantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        ts: Date.now(),
      });
      // Whichever path (this reconcile or the webhook) wins the
      // pending → paid transition first sends the receipt; the other path
      // sees order.paymentStatus === "paid" and skips.
      if (next === "paid") {
        const full = await db.order.findUnique({
          where: { id: order.id },
          include: { items: true, restaurant: true },
        });
        if (full) {
          void sendOrderReceipt(full, full.restaurant);
        }
      }
    }
    return { ok: true, status: next };
  } catch (e) {
    console.error("[reconcilePaymentForOrder]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Reconcile failed" };
  }
}

function mapPaymentStatus(s: string): "pending" | "paid" | "failed" {
  switch (s) {
    case "succeeded":
      return "paid";
    case "requires_payment_method":
    case "canceled":
      return "failed";
    default:
      return "pending";
  }
}
