import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Clock, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { statusLabel, statusTone, type OrderStatus } from "@/lib/order-status";
import { OrderStatusControls } from "@/components/admin/order-status-controls";
import { LiveConnection } from "@/components/restaurant/live-connection";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, restaurant: true },
  });
  if (!order || order.restaurant.slug !== slug) notFound();

  const tone = statusTone(order.status);

  return (
    <>
      <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link
            href={`/r/${slug}/admin`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" /> Back to orders
          </Link>
          <LiveConnection
            url={`/api/r/${slug}/order/${order.id}/stream`}
            refreshOnEvent
          />
        </div>

        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="font-display text-4xl text-surface-900">
              Order #{order.orderNumber}
            </h1>
            <p className="text-sm text-surface-500 mt-1">
              Placed {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} animate-pulse`} />
            {statusLabel(order.status)}
          </span>
        </div>

        <div className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 mb-6">
          <OrderStatusControls
            slug={slug}
            orderId={order.id}
            status={order.status as OrderStatus}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <section className="rounded-2xl border border-surface-200 bg-white p-6">
            <h2 className="font-display text-xl text-surface-900">Customer</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">Name</div>
                <div className="text-surface-900 font-medium mt-0.5">{order.customerName}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Phone
                </div>
                <a
                  href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`}
                  className="mt-0.5 inline-flex items-center gap-1.5 text-surface-900 font-medium hover:text-brand"
                >
                  <Phone className="h-3.5 w-3.5" /> {order.customerPhone}
                </a>
              </div>
              {order.customerEmail && (
                <div>
                  <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Email
                  </div>
                  <a
                    href={`mailto:${order.customerEmail}`}
                    className="mt-0.5 inline-flex items-center gap-1.5 text-surface-900 font-medium hover:text-brand"
                  >
                    <Mail className="h-3.5 w-3.5" /> {order.customerEmail}
                  </a>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-surface-200 bg-white p-6">
            <h2 className="font-display text-xl text-surface-900">Pickup</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Time
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-surface-900 font-medium">
                  <Clock className="h-3.5 w-3.5" /> {order.pickupTime}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Payment
                </div>
                <div className="mt-0.5 text-surface-900 font-medium">Pay at pickup</div>
              </div>
            </div>
          </section>
        </div>

        {order.notes && (
          <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-900">Notes from customer</div>
                <div className="text-sm text-amber-800 mt-1 whitespace-pre-line">
                  {order.notes}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
          <h2 className="font-display text-2xl text-surface-900">Items</h2>
          <ul className="mt-5 divide-y divide-surface-100">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-4 py-4">
                <div>
                  <div className="font-medium text-surface-900">
                    <span className="text-surface-500 mr-2 font-mono tabular-nums">
                      {it.quantity}×
                    </span>
                    {it.name}
                  </div>
                  {it.notes && (
                    <div className="text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-full inline-flex px-2 py-0.5 mt-1.5">
                      Note: {it.notes}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-surface-900 tabular-nums">
                    {formatMoney(it.priceCents * it.quantity)}
                  </div>
                  <div className="text-xs text-surface-500 font-mono">
                    {formatMoney(it.priceCents)} each
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <dl className="mt-6 pt-4 border-t border-surface-200 space-y-2 text-sm">
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
            <div className="flex justify-between text-surface-900 font-semibold pt-2 border-t border-surface-100 text-base">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">{formatMoney(order.totalCents)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
