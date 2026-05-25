import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { formatMoney } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/order-status";

export const dynamic = "force-dynamic";
export const metadata = { title: "All orders" };

export default async function AllOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();

  const where = { restaurantId: r.id, ...(sp.status ? { status: sp.status } : {}) };
  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const statusOptions = [
    { value: "", label: "All" },
    { value: "new", label: "New" },
    { value: "preparing", label: "Preparing" },
    { value: "ready", label: "Ready" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">All orders</h1>
          <p className="text-sm text-surface-500 mt-1">
            Latest 100 orders. Filter by status.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-surface-100 p-1">
          {statusOptions.map((o) => {
            const active = (sp.status ?? "") === o.value;
            return (
              <Link
                key={o.value}
                href={
                  o.value
                    ? `/r/${slug}/admin/orders?status=${o.value}`
                    : `/r/${slug}/admin/orders`
                }
                className={`rounded-full px-3.5 h-8 inline-flex items-center text-xs font-medium transition ${
                  active ? "bg-white text-surface-900 shadow-soft" : "text-surface-600 hover:text-surface-900"
                }`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-surface-200 bg-white overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 border-b border-surface-200">
            <tr className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Pickup</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-surface-500">
                  No orders yet.
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const tone = statusTone(o.status);
              return (
                <tr
                  key={o.id}
                  className="hover:bg-surface-50 transition cursor-pointer"
                >
                  <td className="px-5 py-3 font-mono font-medium text-surface-900">
                    <Link href={`/r/${slug}/admin/orders/${o.id}`} className="block">
                      #{o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/r/${slug}/admin/orders/${o.id}`} className="block">
                      <div className="font-medium text-surface-900">{o.customerName}</div>
                      <div className="text-xs text-surface-500">{o.customerPhone}</div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-surface-700">
                    <Link href={`/r/${slug}/admin/orders/${o.id}`}>{o.pickupTime}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">
                    {formatMoney(o.totalCents)}
                  </td>
                  <td className="px-5 py-3 text-xs text-surface-500">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
