import { notFound } from "next/navigation";
import Link from "next/link";
import { TrendingUp, Package, ExternalLink, Sparkles, Settings, Palette, Receipt, Trophy } from "lucide-react";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { clientTypeMeta, parseServices } from "@/lib/client-type";
import { OrderCard } from "@/components/admin/order-card";
import { LiveOrderFeed } from "@/components/admin/live-order-feed";
import { RevenueStat } from "@/components/admin/revenue-stat";

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
  const meta = clientTypeMeta(r.type);

  // Service businesses don't have orders — render an overview page instead.
  if (!meta.hasOrdering) {
    const services = parseServices(r.services);
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-surface-900">Overview</h1>
          <p className="text-sm text-surface-500 mt-1">
            Manage what your customers see on your site.
          </p>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-brand to-brand p-1 mb-6 shadow-elevated">
          <div className="rounded-[20px] bg-white p-7 md:p-9 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-brand">
                Your site is live
              </div>
              <h2 className="mt-1 font-display text-3xl text-surface-900">{r.name}</h2>
              <div className="mt-2 text-sm text-surface-600">
                Visit your public site to see what customers see, or send the link to anyone.
              </div>
            </div>
            <Link
              href={`/r/${r.slug}`}
              target="_blank"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand text-brand-fg px-5 text-sm font-medium shadow-soft hover:brightness-105 transition"
            >
              View public site
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href={`/r/${r.slug}/admin/services`}
            className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft hover:shadow-elevated transition group"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 grid place-items-center rounded-full bg-brand/10 text-brand">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-xs text-surface-500">→</span>
            </div>
            <div className="mt-3 font-display text-xl text-surface-900">Services</div>
            <div className="text-sm text-surface-500 mt-0.5">
              {services.length} service{services.length === 1 ? "" : "s"} shown on site
            </div>
          </Link>

          <Link
            href={`/r/${r.slug}/admin/settings`}
            className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft hover:shadow-elevated transition group"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 grid place-items-center rounded-full bg-brand/10 text-brand">
                <Settings className="h-5 w-5" />
              </div>
              <span className="text-xs text-surface-500">→</span>
            </div>
            <div className="mt-3 font-display text-xl text-surface-900">Settings</div>
            <div className="text-sm text-surface-500 mt-0.5">
              Name, contact, hours, address
            </div>
          </Link>

          <Link
            href={`/r/${r.slug}/admin/settings`}
            className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft hover:shadow-elevated transition group"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 grid place-items-center rounded-full bg-brand/10 text-brand">
                <Palette className="h-5 w-5" />
              </div>
              <span className="text-xs text-surface-500">→</span>
            </div>
            <div className="mt-3 font-display text-xl text-surface-900">Branding</div>
            <div className="text-sm text-surface-500 mt-0.5">Colors, hero, copy</div>
          </Link>
        </div>
      </div>
    );
  }

  // Today bounds (server-local TZ)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Card orders that haven't been paid for yet must not appear in the kitchen
  // queue or revenue stats — they may still fail. The webhook + return-url
  // reconciliation flip them to "paid" when Stripe confirms.
  const kitchenVisible = {
    OR: [{ paymentMethod: "pay_at_pickup" }, { paymentStatus: "paid" }],
  };

  const [newOrders, preparingOrders, readyOrders, recentDone, todayStats, topItemRows, maxOrder] =
    await Promise.all([
      db.order.findMany({
        where: { restaurantId: r.id, status: "new", ...kitchenVisible },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: { restaurantId: r.id, status: "preparing", ...kitchenVisible },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: { restaurantId: r.id, status: "ready", ...kitchenVisible },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: {
          restaurantId: r.id,
          status: { in: ["completed", "cancelled"] },
          updatedAt: { gte: startOfDay },
          ...kitchenVisible,
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
          // Revenue counts only orders that are actually paid OR pay-at-pickup
          // (don't double-count pending-card orders that may fail).
          ...kitchenVisible,
        },
        _sum: { totalCents: true },
        _count: { id: true },
      }),
      db.orderItem.groupBy({
        by: ["name"],
        where: {
          order: {
            restaurantId: r.id,
            createdAt: { gte: startOfDay },
            status: { not: "cancelled" },
            ...kitchenVisible,
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 1,
      }),
      db.order.aggregate({
        where: { restaurantId: r.id },
        _max: { orderNumber: true },
      }),
    ]);

  const revenueCents = todayStats._sum.totalCents ?? 0;
  const orderCount = todayStats._count.id ?? 0;
  const avgTicketCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0;
  const topItem = topItemRows[0]
    ? { name: topItemRows[0].name, count: topItemRows[0]._sum.quantity ?? 0 }
    : null;

  const stats = {
    revenue: revenueCents,
    orderCount,
    pendingCount: newOrders.length + preparingOrders.length,
    avgTicket: avgTicketCents,
    topItem,
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
      <div className="px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-4xl text-surface-900">Today&apos;s orders</h1>
              <LiveOrderFeed
                slug={slug}
                initialMaxOrderNumber={maxOrder._max.orderNumber ?? 0}
              />
            </div>
            <p className="text-sm text-surface-500 mt-1">
              New orders and status changes appear here instantly.
            </p>
          </div>
          <Link
            href={`/r/${slug}/admin/orders`}
            className="text-sm font-medium text-brand hover:underline"
          >
            View all orders →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-10">
          <RevenueStat
            slug={slug}
            revenueCents={stats.revenue}
            hasPin={r.revenuePinHash !== null}
          />
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="Orders today"
            value={String(stats.orderCount)}
          />
          <StatCard
            icon={<Receipt className="h-5 w-5" />}
            label="Avg ticket"
            value={stats.orderCount > 0 ? formatMoney(stats.avgTicket) : "—"}
          />
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            label="Top item"
            value={stats.topItem ? stats.topItem.name : "—"}
            sublabel={stats.topItem ? `${stats.topItem.count} sold` : undefined}
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
  sublabel,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
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
      <div className="mt-3 font-display text-2xl text-surface-900 tabular-nums truncate">
        {value}
      </div>
      {sublabel && (
        <div className="text-xs text-surface-500 mt-1">{sublabel}</div>
      )}
    </div>
  );
}
