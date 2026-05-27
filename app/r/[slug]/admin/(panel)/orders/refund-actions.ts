"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { emitOrderEvent } from "@/lib/order-events";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const RefundOrderSchema = z.object({
  slug: z.string().min(1),
  orderId: z.string().min(1),
});

export interface RefundOrderResult {
  ok: boolean;
  error?: string;
}

/**
 * Issues a full refund against the order's Stripe PaymentIntent using the
 * restaurant's connected account. On success flips:
 *   paymentStatus → "refunded"
 *   status        → "cancelled"
 *
 * Only callable on paid card orders. Cash / pay-at-pickup orders cannot be
 * refunded here — operators handle those manually.
 */
export async function refundOrder(
  raw: z.infer<typeof RefundOrderSchema>
): Promise<RefundOrderResult> {
  const parsed = RefundOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  const { slug, orderId } = parsed.data;

  const auth = await requireRestaurantAdmin(slug);
  if (!auth.authorized) {
    return { ok: false, error: auth.reason ?? "Not authorized" };
  }
  const { restaurant } = auth;

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.restaurantId !== restaurant.id) {
    return { ok: false, error: "Order not found" };
  }
  if (order.paymentMethod !== "card") {
    return { ok: false, error: "Only card payments can be refunded here." };
  }
  if (order.paymentStatus !== "paid") {
    return { ok: false, error: "This order isn't paid — nothing to refund." };
  }
  if (!order.stripePaymentIntentId) {
    return { ok: false, error: "Order has no Stripe payment to refund." };
  }
  if (!isStripeConfigured() || !restaurant.stripeAccountId) {
    return { ok: false, error: "Stripe is not configured for this restaurant." };
  }

  try {
    const stripe = getStripe();
    await stripe.refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        // Refund the platform fee too so the operator isn't out the cut.
        refund_application_fee: true,
        // Reverse the transfer so the restaurant returns its share.
        reverse_transfer: true,
        metadata: {
          orderId: order.id,
          orderNumber: String(order.orderNumber),
          restaurantId: restaurant.id,
          restaurantSlug: slug,
        },
      },
      { stripeAccount: restaurant.stripeAccountId }
    );
  } catch (e) {
    console.error("[refundOrder] stripe.refunds.create failed", e);
    return {
      ok: false,
      error: e instanceof Error ? `Refund failed: ${e.message}` : "Refund failed",
    };
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "refunded",
      status: "cancelled",
    },
  });

  emitOrderEvent({
    kind: "updated",
    restaurantId: restaurant.id,
    orderId: updated.id,
    orderNumber: updated.orderNumber,
    status: updated.status,
    ts: Date.now(),
  });

  revalidatePath(`/r/${slug}/admin`);
  revalidatePath(`/r/${slug}/admin/orders`);
  revalidatePath(`/r/${slug}/admin/orders/${orderId}`);
  revalidatePath(`/r/${slug}/order/${orderId}`);

  return { ok: true };
}
