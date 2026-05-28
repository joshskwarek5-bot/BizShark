import Link from "next/link";
import { db } from "@/lib/db";
import { Users, CalendarClock, MapPin, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operators" };

export default async function OperatorsPage() {
  const operators = await db.operator.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { restaurants: true } },
    },
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Operators</h1>
          <p className="text-sm text-surface-500 mt-1">
            Every paying SaaS user. Each owns 0..N client restaurants.
          </p>
        </div>
        <div className="text-sm text-surface-500">
          {operators.length} operator{operators.length === 1 ? "" : "s"} total
        </div>
      </div>

      {operators.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-surface-400" />
          <div className="mt-4 font-display text-2xl text-surface-900">
            No operators yet
          </div>
          <p className="mt-1 text-surface-500">
            Operators sign up at <code className="font-mono text-sm">/signup</code>.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-surface-200 bg-white overflow-hidden shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 border-b border-surface-200">
              <tr className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                <th className="px-5 py-3">Operator</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Clients</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {operators.map((op) => (
                <tr key={op.id} className="hover:bg-surface-50">
                  <td className="px-5 py-4">
                    <div className="font-medium text-surface-900">
                      {op.businessName ?? op.name ?? "—"}
                    </div>
                    {op.businessName && op.name && (
                      <div className="text-xs text-surface-500">{op.name}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-surface-700">{op.email}</td>
                  <td className="px-5 py-4 text-surface-700">
                    {op.areaCity ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-surface-400" />
                        {op.areaCity}
                        {op.areaState ? `, ${op.areaState}` : ""}
                      </span>
                    ) : (
                      <span className="text-surface-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono tabular-nums text-surface-700">
                    {op._count.restaurants}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          op.subscriptionStatus === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : op.subscriptionStatus === "trial"
                              ? "bg-sky-50 text-sky-700 ring-sky-200"
                              : "bg-amber-50 text-amber-700 ring-amber-200"
                        }`}
                      >
                        {op.subscriptionStatus === "trial" && <CalendarClock className="h-3 w-3" />}
                        {op.subscriptionTier} · {op.subscriptionStatus}
                      </span>
                      {op.stripeCustomerId && (
                        <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-emerald-600 bg-emerald-50 ring-1 ring-inset ring-emerald-200" title="Card on file">
                          <CreditCard className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-surface-500">
                    {op.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
