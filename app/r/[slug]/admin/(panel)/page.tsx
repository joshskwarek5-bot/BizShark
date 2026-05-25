import { notFound } from "next/navigation";
import Link from "next/link";
import { TrendingUp, DollarSign, Package } from "lucide-react";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { OrderCard } from "@/components/admin/order-card";
import { PollRefresh } from "@/components/restaurant/poll-refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();

  // Today bounds (server-local TZ)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [newOrders, preparingOrders, readyOrders, recentDone, todayStats] =
    await Promise.all([
      db.order.findMany({
        where: { restaurantId: r.id, status: "new" },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: { restaurantId: r.id, status: "preparing" },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: { restaurantId: r.id, status: "ready" },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: {
          restaurantId: r.id,
          status: { in: ["completed", "cancelled"] },
          updatedAt: { gte: startOfDay },
        },
        include: { items: true },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      db.order.aggregate({
        where: {
          restaurantId: r.id,
          createdAt: { gte: startOfDay },
          status: { not: "cancelled" },
        },
        _sum: { totalCents: true },
        _count: { id: true },
      }),
    ]);

  const stats = {
    revenue: todayStats._sum.totalCents ?? 0,
    orderCount: todayStats._count.id ?? 0,
    pendingCount: newOrders.length + preparingOrders.length,
  };

  const sections = [
    { key: "new", title: "New", count: newOrders.length, orders: newOrders, color: "sky" },
    {
      key: "preparing",
      title: "Preparing",
      count: preparingOrders.length,
      orders: preparingOrders,
      color: "amber",
    },
    { key: "ready", title: "Ready", count: readyOrders.length, orders: readyOrders, color: "emerald" },
  ];

  return (
    <>
      <PollRefresh intervalMs={8000} />
      <div className="px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="font-display text-4xl text-surface-900">Today&apos;s orders</h1>
            <p className="text-sm text-surface-500 mt-1">
              Live view — updates automatically. Click any order for details.
            </p>
          </div>
          <Link
            href={`/r/${slug}/admin/orders`}
            className="text-sm font-medium text-brand hover:underline"
          >
            View all orders →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-10">
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Revenue today"
            value={formatMoney(stats.revenue)}
            tone="brand"
          />
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="Orders today"
            value={String(stats.orderCount)}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Active in queue"
            value={String(stats.pendingCount)}
            tone={stats.pendingCount > 0 ? "amber" : undefined}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {sections.map((sec) => (
            <section key={sec.key}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-xl text-surface-900">
                  {sec.title}
                </h2>
                <span className="text-sm font-mono text-surface-500 tabular-nums">
                  {sec.count}
                </span>
              </div>
              <div className="grid gap-3">
                {sec.orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-white/60 py-10 text-center text-sm text-surface-500">
                    Nothing here yet.
                  </div>
                ) : (
                  sec.orders.map((o) => <OrderCard key={o.id} slug={slug} order={o} />)
                )}
              </div>
            </section>
          ))}
        </div>

        {recentDone.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl text-surface-900">Recently completed</h2>
              <span className="text-sm font-mono text-surface-500 tabular-nums">
                {recentDone.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentDone.map((o) => (
                <OrderCard key={o.id} slug={slug} order={o} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "brand" | "amber";
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
          {label}
        </div>
        <div
          className={
            tone === "brand"
              ? "h-9 w-9 grid place-items-center rounded-full bg-brand/10 text-brand"
              : tone === "amber"
                ? "h-9 w-9 grid place-items-center rounded-full bg-amber-100 text-amber-700"
                : "h-9 w-9 grid place-items-center rounded-full bg-surface-100 text-surface-600"
          }
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 font-display text-3xl text-surface-900 tabular-nums">{value}</div>
    </div>
  );
}
