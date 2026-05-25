import Link from "next/link";
import { Plus, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { RestaurantRowActions } from "./row-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Restaurants" };

export default async function RestaurantsListPage() {
  const restaurants = await db.restaurant.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { orders: true, items: true } },
      orders: {
        where: { status: { not: "cancelled" } },
        select: { totalCents: true },
      },
    },
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Clients</h1>
          <p className="text-sm text-surface-500 mt-1">
            All clients. Click any row to open their admin.
          </p>
        </div>
        <Link
          href="/platform/restaurants/new"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-soft"
        >
          <Plus className="h-4 w-4" /> New client
        </Link>
      </div>

      <div className="rounded-3xl border border-surface-200 bg-white overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 border-b border-surface-200">
            <tr className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
              <th className="px-5 py-3">Client</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Items</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Revenue</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {restaurants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-surface-500">
                  No clients yet.{" "}
                  <Link href="/platform/restaurants/new" className="text-brand hover:underline">
                    Add one
                  </Link>
                  .
                </td>
              </tr>
            )}
            {restaurants.map((r) => {
              const revenue = r.orders.reduce((acc, o) => acc + o.totalCents, 0);
              return (
                <tr key={r.id} className="hover:bg-surface-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: r.primaryColor }}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-surface-900 flex items-center gap-2">
                          {r.name}
                          {r.isPrimary && (
                            <span className="inline-flex items-center rounded-full bg-brand/10 text-brand px-1.5 py-0.5 text-[10px] font-medium">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-surface-500">/r/{r.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-surface-700">
                    {r.city && r.state ? `${r.city}, ${r.state}` : r.address}
                  </td>
                  <td className="px-5 py-4 font-mono tabular-nums text-surface-700">
                    {r._count.items}
                  </td>
                  <td className="px-5 py-4 font-mono tabular-nums text-surface-700">
                    {r._count.orders}
                  </td>
                  <td className="px-5 py-4 font-mono tabular-nums text-surface-700">
                    {formatMoney(revenue)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        r.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-amber-200"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.isActive ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/r/${r.slug}`}
                        target="_blank"
                        className="h-8 w-8 grid place-items-center rounded-full text-surface-400 hover:bg-surface-100 hover:text-surface-800"
                        aria-label="View"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/r/${r.slug}/admin`}
                        className="inline-flex h-8 items-center px-3 rounded-full bg-surface-100 text-xs font-medium text-surface-800 hover:bg-surface-200"
                      >
                        Admin
                      </Link>
                      <RestaurantRowActions
                        id={r.id}
                        name={r.name}
                        isActive={r.isActive}
                        isPrimary={r.isPrimary}
                      />
                    </div>
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
