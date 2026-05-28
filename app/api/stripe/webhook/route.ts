import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { deriveAccountState, getStripe, isStripeConfigured } from "@/lib/stripe";
import { emitOrderEvent } from "@/lib/order-events";
import { sendOrderReceipt } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Stripe webhook receiver. Required signature header is verified with
 * STRIPE_WEBHOOK_SECRET (set after registering the endpoint in the Stripe
 * dashboard or via `stripe listen --forward-to`).
 *
 * Events handled:
 *   payment_intent.succeeded   → Order.paymentStatus = "paid"
 *   payment_intent.payment_failed | payment_intent.canceled → "failed"
 *   account.updated → refresh Restaurant.stripe* flags
 *
 * Idempotent: all DB writes are conditional on current state, so re-deliveries
 * are no-ops.
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not set on this deployment" },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Stripe requires the raw body for signature verification
  const rawBody = await req.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("[stripe-webhook] signature verification failed", e);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, "paid");
        break;
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, "failed");
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      // Operator subscription lifecycle
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        await handleInvoiceEvent(event.data.object as Stripe.Invoice);
        break;
      default:
        // Acknowledge other events so Stripe doesn't retry; we just don't act.
        break;
    }
  } catch (e) {
    console.error(`[stripe-webhook] handler error for ${event.type}`, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---- Operator subscriptions ----

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const operatorId = session.client_reference_id;
  if (!operatorId) return;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  if (!customerId || !subscriptionId) return;
  await db.operator.update({
    where: { id: operatorId },
    data: { stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId },
  });
}

async function handleSubscriptionEvent(sub: Stripe.Subscription) {
  const operator = await db.operator.findFirst({
    where: {
      OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: sub.customer as string }],
    },
  });
  if (!operator) {
    console.warn(`[stripe-webhook] no operator found for subscription ${sub.id}`);
    return;
  }
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
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : operator.trialEndsAt,
    },
  });
}

async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  // Phase 9 operator-bills-client will expand this. For now just log.
  console.log(`[stripe-webhook] invoice ${invoice.id} status=${invoice.status}`);
}

function mapStripeStatus(s: string): string {
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

async function handlePaymentIntent(
  pi: Stripe.PaymentIntent,
  paymentStatus: "paid" | "failed"
) {
  const order = await db.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
  });
  if (!order) {
    // Could be a PI from another system, ignore.
    console.warn(`[stripe-webhook] no order found for PI ${pi.id}`);
    return;
  }
  if (order.paymentStatus === paymentStatus) {
    return; // idempotent — already in this state
  }
  // Receipt URL lives on the latest_charge
  let receiptUrl: string | null = order.stripeReceiptUrl;
  if (paymentStatus === "paid") {
    if (pi.latest_charge && typeof pi.latest_charge !== "string") {
      receiptUrl = pi.latest_charge.receipt_url ?? receiptUrl;
    } else if (typeof pi.latest_charge === "string") {
      try {
        const connectedAccountId = order.restaurantId
          ? (await db.restaurant.findUnique({
              where: { id: order.restaurantId },
              select: { stripeAccountId: true },
            }))?.stripeAccountId ?? undefined
          : undefined;
        const ch = await getStripe().charges.retrieve(
          pi.latest_charge,
          {},
          connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
        );
        receiptUrl = ch.receipt_url ?? receiptUrl;
      } catch (e) {
        console.warn("[stripe-webhook] charge fetch failed", e);
      }
    }
  }

  await db.order.update({
    where: { id: order.id },
    data: { paymentStatus, stripeReceiptUrl: receiptUrl },
  });

  emitOrderEvent({
    kind: paymentStatus === "paid" ? "created" : "updated",
    restaurantId: order.restaurantId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    ts: Date.now(),
  });

  // Fire off the customer receipt on the paid transition. Best-effort —
  // sendOrderReceipt never throws and logs its own errors, so a failed email
  // never blocks a successful Stripe webhook ack.
  if (paymentStatus === "paid") {
    const full = await db.order.findUnique({
      where: { id: order.id },
      include: { items: true, restaurant: true },
    });
    if (full) {
      void sendOrderReceipt(full, full.restaurant);
    }
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  const restaurant = await db.restaurant.findFirst({
    where: { stripeAccountId: account.id },
  });
  if (!restaurant) return; // unknown account, ignore
  const state = deriveAccountState(account);
  if (
    restaurant.stripeAccountStatus === state.status &&
    restaurant.stripeChargesEnabled === state.chargesEnabled &&
    restaurant.stripePayoutsEnabled === state.payoutsEnabled
  ) {
    return; // no change
  }
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      stripeAccountStatus: state.status,
      stripeChargesEnabled: state.chargesEnabled,
      stripePayoutsEnabled: state.payoutsEnabled,
    },
  });
}
