import Link from "next/link";
import { Plus, Store, DollarSign, ShoppingBag, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform overview" };

export default async function PlatformOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [clients, totalOrdersToday, revenueToday, allOrdersCount] = await Promise.all([
    db.restaurant.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { orders: true, items: true } },
      },
    }),
    db.order.count({
      where: { createdAt: { gte: startOfDay }, status: { not: "cancelled" } },
    }),
    db.order.aggregate({
      where: { createdAt: { gte: startOfDay }, status: { not: "cancelled" } },
      _sum: { totalCents: true },
    }),
    db.order.count(),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Overview</h1>
          <p className="text-sm text-surface-500 mt-1">
            Your clients, at a glance.
          </p>
        </div>
        <Link
          href="/platform/restaurants/new"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-soft"
        >
          <Plus className="h-4 w-4" /> New client
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <StatCard
          icon={<Store className="h-5 w-5" />}
          label="Clients"
          value={String(clients.length)}
        />
        <StatCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Orders today"
          value={String(totalOrdersToday)}
          sublabel={`${allOrdersCount} all-time`}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Revenue today"
          value={formatMoney(revenueToday._sum.totalCents ?? 0)}
          tone="brand"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-surface-900">All clients</h2>
          <Link href="/platform/restaurants" className="text-sm text-brand font-medium hover:underline">
            Manage →
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
            <div className="font-display text-2xl text-surface-900">No clients yet</div>
            <p className="mt-1 text-surface-500">
              Add your first client to get started.
            </p>
            <Link
              href="/platform/restaurants/new"
              className="inline-flex mt-6 h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-soft"
            >
              <Plus className="h-4 w-4" /> New client
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {clients.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft hover:shadow-elevated transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: r.primaryColor }}
                      />
                      <div className="font-display text-lg text-surface-900 truncate">
                        {r.name}
                      </div>
                    </div>
                    <div className="text-xs text-surface-500 truncate">
                      /r/{r.slug}
                      {r.isPrimary && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-brand/10 text-brand px-1.5 py-0.5 text-[10px] font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                  </div>
                  {!r.isActive && (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-surface-500">Items</div>
                    <div className="font-mono font-medium text-surface-900 tabular-nums">
                      {r._count.items}
                    </div>
                  </div>
                  <div>
                    <div className="text-surface-500">Orders</div>
                    <div className="font-mono font-medium text-surface-900 tabular-nums">
                      {r._count.orders}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  <Link
                    href={`/r/${r.slug}/admin`}
                    className="flex-1 inline-flex items-center justify-center h-9 rounded-full bg-surface-100 text-sm font-medium text-surface-800 hover:bg-surface-200 transition"
                  >
                    Open admin
                  </Link>
                  <Link
                    href={`/r/${r.slug}`}
                    target="_blank"
                    className="h-9 w-9 grid place-items-center rounded-full text-surface-500 hover:bg-surface-100 hover:text-surface-800 transition"
                    aria-label="View public site"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
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
  tone?: "brand";
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
              : "h-9 w-9 grid place-items-center rounded-full bg-surface-100 text-surface-600"
          }
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 font-display text-3xl text-surface-900 tabular-nums">{value}</div>
      {sublabel && <div className="text-xs text-surface-500 mt-0.5">{sublabel}</div>}
    </div>
  );
}
