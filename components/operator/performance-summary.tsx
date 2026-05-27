import Link from "next/link";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";

interface PerformanceSummaryProps {
  operatorId: string;
}

/**
 * "This week" revenue table across every active restaurant an operator
 * owns. Renders nothing if the operator has no active clients yet.
 */
export async function PerformanceSummary({ operatorId }: PerformanceSummaryProps) {
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - 6); // rolling 7 days incl. today

  const clients = await db.restaurant.findMany({
    where: { operatorId, isActive: true },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });

  if (clients.length === 0) return null;

  // Only count orders that are actually paid OR pay-at-pickup (mirrors the
  // kitchen page filter — keeps pending-card orders out of revenue).
  const paymentOk = {
    OR: [{ paymentMethod: "pay_at_pickup" }, { paymentStatus: "paid" }],
  };

  const aggregates = await db.order.groupBy({
    by: ["restaurantId"],
    where: {
      restaurantId: { in: clients.map((c) => c.id) },
      createdAt: { gte: startOfWeek },
      status: { not: "cancelled" },
      ...paymentOk,
    },
    _sum: { totalCents: true },
    _count: { id: true },
  });

  const byRestaurant = new Map(
    aggregates.map((a) => [
      a.restaurantId,
      {
        revenue: a._sum.totalCents ?? 0,
        orders: a._count.id ?? 0,
      },
    ])
  );

  const rows = clients
    .map((c) => {
      const stat = byRestaurant.get(c.id) ?? { revenue: 0, orders: 0 };
      const avgTicket = stat.orders > 0 ? Math.round(stat.revenue / stat.orders) : 0;
      return { ...c, ...stat, avgTicket };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

  return (
    <section className="mb-8 rounded-3xl border border-surface-200 bg-white shadow-soft overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-surface-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-full bg-brand/10 text-brand">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl text-surface-900 leading-none">
              This week
            </h2>
            <p className="text-xs text-surface-500 mt-1">
              Last 7 days across your active clients
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl text-surface-900 tabular-nums">
            {formatMoney(totalRevenue)}
          </div>
          <div className="text-xs text-surface-500 mt-0.5">
            {totalOrders} order{totalOrders === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      <div className="divide-y divide-surface-100">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-2 text-xs font-medium text-surface-500 uppercase tracking-wider bg-surface-50">
          <div>Client</div>
          <div className="text-right w-20">Orders</div>
          <div className="text-right w-24">Revenue</div>
          <div className="text-right w-24">Avg ticket</div>
        </div>
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/r/${row.slug}/admin`}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3 hover:bg-surface-50 transition group"
          >
            <div className="min-w-0">
              <div className="font-medium text-surface-900 truncate flex items-center gap-1.5">
                {row.name}
                <ArrowUpRight className="h-3.5 w-3.5 text-surface-300 group-hover:text-brand transition" />
              </div>
              {row.orders === 0 && (
                <div className="text-xs text-amber-700 mt-0.5">No orders this week</div>
              )}
            </div>
            <div className="text-right w-20 font-mono tabular-nums text-surface-700">
              {row.orders}
            </div>
            <div className="text-right w-24 font-mono tabular-nums text-surface-900">
              {formatMoney(row.revenue)}
            </div>
            <div className="text-right w-24 font-mono tabular-nums text-surface-500">
              {row.orders > 0 ? formatMoney(row.avgTicket) : "—"}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
