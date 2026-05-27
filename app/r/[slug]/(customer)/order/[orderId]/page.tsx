import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Check, Clock, Phone, MapPin, ChefHat, PartyPopper, X, CreditCard, AlertCircle, RotateCcw } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { ORDER_STATUSES, statusLabel, statusTone } from "@/lib/order-status";
import { LiveOrderStatus } from "@/components/restaurant/live-order-status";
import { OrderCountdown } from "@/components/restaurant/order-countdown";
import { OrderActions } from "@/components/restaurant/order-actions";
import { reconcilePaymentForOrder } from "@/app/r/[slug]/(customer)/checkout/payment-actions";
import { appBaseUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order confirmation" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const { slug, orderId } = await params;
  const sp = await searchParams;

  // If we're returning from Stripe, reconcile the payment with the latest state
  // before rendering. The webhook is the source of truth; this is the snappy path.
  if (sp.payment_intent) {
    try {
      await reconcilePaymentForOrder(orderId);
    } catch (e) {
      console.error("[order/return] reconcile failed", e);
    }
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      restaurant: true,
    },
  });

  if (!order || order.restaurant.slug !== slug) notFound();

  const tone = statusTone(order.status);
  const stepIndex = Math.max(
    0,
    ORDER_STATUSES.slice(0, 4).indexOf(order.status as (typeof ORDER_STATUSES)[number])
  );
  const cancelled = order.status === "cancelled";
  const refunded = order.paymentStatus === "refunded";
  const orderUrl = `${appBaseUrl()}/r/${slug}/order/${order.id}`;

  return (
    <div className="bg-surface-50 min-h-[60vh]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="rounded-3xl bg-gradient-to-br from-brand to-brand p-1 shadow-elevated">
          <div className="rounded-[20px] bg-white p-8 md:p-10">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono uppercase tracking-widest text-brand">
                    Order placed
                  </div>
                  <LiveOrderStatus
                    slug={slug}
                    orderId={order.id}
                    initialStatus={order.status}
                  />
                </div>
                <h1 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
                  Order #{order.orderNumber}
                </h1>
                <p className="mt-2 text-surface-600">
                  Thanks {order.customerName.split(" ")[0]} — we&apos;ve got it from here.
                </p>
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset ${
                  refunded
                    ? "bg-surface-100 text-surface-700 ring-surface-300"
                    : `${tone.bg} ${tone.text} ${tone.ring}`
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    refunded ? "bg-surface-500" : `${tone.dot} animate-pulse`
                  }`}
                />
                {refunded ? "Refunded" : statusLabel(order.status)}
              </div>
            </div>

            {refunded ? (
              <div className="mt-8 rounded-2xl bg-surface-100 ring-1 ring-surface-200 p-5 flex items-start gap-3">
                <RotateCcw className="h-5 w-5 text-surface-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-surface-900">This order was refunded</div>
                  <div className="text-sm text-surface-700 mt-0.5">
                    {formatMoney(order.totalCents)} has been returned to your card. It can
                    take 5–10 business days to appear on your statement. Questions? Call us
                    at {order.restaurant.phone}.
                  </div>
                </div>
              </div>
            ) : !cancelled ? (
              <>
                <div className="mt-10">
                  <ol className="grid grid-cols-4 gap-2">
                    {[
                      { key: "new", label: "Received", icon: Check },
                      { key: "preparing", label: "Preparing", icon: ChefHat },
                      { key: "ready", label: "Ready", icon: PartyPopper },
                      { key: "completed", label: "Picked up", icon: Check },
                    ].map((s, idx) => {
                      const reached = idx <= stepIndex;
                      const isCurrent = idx === stepIndex;
                      const Icon = s.icon;
                      return (
                        <li key={s.key} className="relative">
                          <div
                            className={`mx-auto h-14 w-14 grid place-items-center rounded-full ring-2 transition ${
                              reached
                                ? "bg-brand text-brand-fg ring-brand"
                                : "bg-surface-100 text-surface-400 ring-surface-200"
                            } ${isCurrent ? "shadow-elevated scale-105" : ""}`}
                          >
                            <Icon className="h-6 w-6" />
                          </div>
                          <div
                            className={`mt-2.5 text-center text-xs sm:text-sm font-medium ${
                              reached ? "text-surface-900" : "text-surface-400"
                            }`}
                          >
                            {s.label}
                          </div>
                          {idx < 3 && (
                            <div
                              className={`absolute top-7 left-[calc(50%+1.75rem)] right-[calc(-50%+1.75rem)] h-1 rounded-full ${
                                idx < stepIndex ? "bg-brand" : "bg-surface-200"
                              }`}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <OrderCountdown
                  pickupTime={order.pickupTime}
                  createdAtMs={new Date(order.createdAt).getTime()}
                  status={order.status}
                />
              </>
            ) : (
              <div className="mt-8 rounded-2xl bg-red-50 ring-1 ring-red-200 p-5 flex items-start gap-3">
                <X className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-800">Your order was cancelled</div>
                  <div className="text-sm text-red-700 mt-0.5">
                    Please call us at {order.restaurant.phone} for details.
                  </div>
                </div>
              </div>
            )}

            <OrderActions
              phone={order.restaurant.phone}
              address={order.restaurant.address}
              city={order.restaurant.city}
              state={order.restaurant.state}
              restaurantName={order.restaurant.name}
              orderNumber={order.orderNumber}
              orderUrl={orderUrl}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-surface-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-surface-500 uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5" /> Pickup time
            </div>
            <div className="mt-2 font-display text-xl text-surface-900">{order.pickupTime}</div>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-surface-500 uppercase tracking-wider">
              <MapPin className="h-3.5 w-3.5" /> Pick up at
            </div>
            <div className="mt-2 font-medium text-surface-900">{order.restaurant.address}</div>
            <div className="text-sm text-surface-600">
              {order.restaurant.city}, {order.restaurant.state}
            </div>
          </div>
          <div className="rounded-2xl border border-surface-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-surface-500 uppercase tracking-wider">
              <Phone className="h-3.5 w-3.5" /> Questions?
            </div>
            <a
              href={`tel:${order.restaurant.phone.replace(/[^\d+]/g, "")}`}
              className="mt-2 block font-medium text-surface-900 hover:text-brand"
            >
              {order.restaurant.phone}
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-surface-200 bg-white p-6 md:p-8">
          <h2 className="font-display text-2xl text-surface-900">Your order</h2>
          <ul className="mt-5 divide-y divide-surface-100">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <div className="font-medium text-surface-900">
                    <span className="text-surface-500 mr-1.5">{it.quantity}×</span>
                    {it.name}
                  </div>
                  {it.notes && (
                    <div className="text-xs text-surface-500 mt-0.5">Note: {it.notes}</div>
                  )}
                </div>
                <div className="font-mono text-sm text-surface-700 tabular-nums shrink-0">
                  {formatMoney(it.priceCents * it.quantity)}
                </div>
              </li>
            ))}
          </ul>

          <dl className="mt-6 border-t border-surface-200 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-surface-700">
              <dt>Subtotal</dt>
              <dd className="font-mono tabular-nums">{formatMoney(order.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between text-surface-700">
              <dt>Tax</dt>
              <dd className="font-mono tabular-nums">{formatMoney(order.taxCents)}</dd>
            </div>
            {order.tipCents > 0 && (
              <div className="flex justify-between text-surface-700">
                <dt>Tip</dt>
                <dd className="font-mono tabular-nums">{formatMoney(order.tipCents)}</dd>
              </div>
            )}
            <div className="flex justify-between text-surface-900 font-semibold pt-2 border-t border-surface-100">
              <dt>
                Total
                {order.paymentMethod === "pay_at_pickup" && " · pay at pickup"}
              </dt>
              <dd className="font-mono tabular-nums">{formatMoney(order.totalCents)}</dd>
            </div>
            {order.paymentMethod === "card" && (
              <PaymentRow
                status={order.paymentStatus}
                receiptUrl={order.stripeReceiptUrl}
              />
            )}
          </dl>

          {order.notes && (
            <div className="mt-4 rounded-xl bg-surface-50 p-4 text-sm">
              <div className="font-medium text-surface-900">Notes for the kitchen</div>
              <div className="text-surface-700 mt-1">{order.notes}</div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/r/${slug}/menu`}
            className="inline-flex h-11 items-center rounded-full bg-surface-100 px-5 text-sm font-medium text-surface-800 hover:bg-surface-200 transition"
          >
            Back to menu
          </Link>
          <Link
            href={`/r/${slug}`}
            className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-brand-fg hover:brightness-105 transition"
          >
            Restaurant home
          </Link>
        </div>
      </div>
    </div>
  );
}

function PaymentRow({
  status,
  receiptUrl,
}: {
  status: string;
  receiptUrl: string | null;
}) {
  if (status === "refunded") {
    return (
      <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-surface-100 ring-1 ring-surface-200 px-3 py-2 text-xs text-surface-700">
        <RotateCcw className="h-3.5 w-3.5" />
        Refunded to your card
      </div>
    );
  }
  if (status === "paid") {
    return (
      <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 text-xs text-emerald-800">
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          Paid by card
        </span>
        {receiptUrl && (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="underline hover:no-underline"
          >
            Receipt →
          </a>
        )}
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-red-50 ring-1 ring-red-200 px-3 py-2 text-xs text-red-800">
        <AlertCircle className="h-3.5 w-3.5" />
        Payment failed — please call the restaurant.
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-xs text-amber-800">
      <CreditCard className="h-3.5 w-3.5 animate-pulse" />
      Processing payment…
    </div>
  );
}
