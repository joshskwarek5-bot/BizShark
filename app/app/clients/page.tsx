import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ExternalLink, CreditCard, Send } from "lucide-react";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { clientTypeMeta } from "@/lib/client-type";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function OperatorClientsPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const clients = await db.restaurant.findMany({
    where: { operatorId: operator.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { items: true, orders: true } },
    },
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Clients</h1>
          <p className="text-sm text-surface-500 mt-1">
            Every business you&apos;ve onboarded. Click any one to open its admin.
          </p>
        </div>
        <Link
          href="/app/clients/new"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-soft"
        >
          <Plus className="h-4 w-4" /> New client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
          <div className="font-display text-2xl text-surface-900">No clients yet</div>
          <p className="mt-1 text-surface-500 max-w-md mx-auto">
            Find a local business without a website, build them a polished site in
            minutes, and pitch them for whatever you want to charge.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/app/leads"
              className="inline-flex h-11 items-center rounded-full bg-surface-100 px-5 text-sm font-medium text-surface-800 hover:bg-surface-200"
            >
              Find leads
            </Link>
            <Link
              href="/app/clients/new"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-soft"
            >
              <Plus className="h-4 w-4" /> Add manually
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((r) => {
            const meta = clientTypeMeta(r.type);
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft hover:shadow-elevated transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: r.primaryColor }}
                      />
                      <div className="font-display text-lg text-surface-900 truncate">
                        {r.name}
                      </div>
                    </div>
                    <div className="text-xs text-surface-500 truncate">
                      {meta.label} · /r/{r.slug}
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
                    <div className="text-surface-500">
                      {meta.hasMenu ? "Items" : "Services"}
                    </div>
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
                    href={`/app/clients/${r.slug}`}
                    className="flex-1 inline-flex items-center justify-center h-9 rounded-full bg-brand text-brand-fg text-sm font-medium hover:brightness-105 transition shadow-soft"
                  >
                    Open
                  </Link>
                  <Link
                    href={`/app/clients/${r.slug}/billing`}
                    className="h-9 w-9 grid place-items-center rounded-full text-surface-500 hover:bg-brand/10 hover:text-brand transition"
                    aria-label="Billing"
                    title="Billing"
                  >
                    <CreditCard className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/app/clients/${r.slug}/handoff`}
                    className="h-9 w-9 grid place-items-center rounded-full text-surface-500 hover:bg-emerald-50 hover:text-emerald-700 transition"
                    aria-label="Send setup link"
                    title="Hand off"
                  >
                    <Send className="h-4 w-4" />
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
            );
          })}
        </div>
      )}
    </div>
  );
}
