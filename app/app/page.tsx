import Link from "next/link";
import {
  Plus,
  Search,
  Users,
  Sparkles,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function OperatorDashboard() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const [clientCount, activeClientCount] = await Promise.all([
    db.restaurant.count({ where: { operatorId: operator.id } }),
    db.restaurant.count({ where: { operatorId: operator.id, isActive: true } }),
  ]);

  const trialDaysLeft = operator.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((operator.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">
            Welcome{operator.name ? `, ${operator.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            {clientCount === 0
              ? "Get your first client live in under 10 minutes."
              : `You're managing ${clientCount} client${clientCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        {operator.subscriptionStatus === "trial" && trialDaysLeft !== null && (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 ring-1 ring-amber-200 px-3.5 py-1.5 text-xs font-medium text-amber-800">
            <CalendarClock className="h-3.5 w-3.5" />
            {trialDaysLeft > 0
              ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in trial`
              : "Trial ended"}
          </div>
        )}
      </div>

      {clientCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 mb-10">
          <StatCard label="Active clients" value={String(activeClientCount)} />
          <StatCard
            label="Total clients"
            value={String(clientCount)}
            sublabel={clientCount === activeClientCount ? "All active" : `${clientCount - activeClientCount} inactive`}
          />
          <StatCard label="Plan" value={operator.subscriptionTier} sublabel={operator.subscriptionStatus} />
        </div>
      )}

      <section>
        <h2 className="font-display text-xl text-surface-900 mb-4">Get started</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <ActionCard
            href="/app/leads"
            icon={<Search className="h-5 w-5" />}
            title="Find leads"
            description="Search your area for businesses without websites."
            cta="Open lead engine"
          />
          <ActionCard
            href="/app/clients/new"
            icon={<Plus className="h-5 w-5" />}
            title="Add a client"
            description="Spin up a polished site for a business you've already won."
            cta="Create new client"
          />
          <ActionCard
            href="/app/clients"
            icon={<Users className="h-5 w-5" />}
            title="Manage clients"
            description="View, edit, or open any of your existing client sites."
            cta="View clients"
          />
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-brand to-brand p-1 mb-8 shadow-elevated">
      <div className="rounded-[20px] bg-white p-8 md:p-10 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-3xl text-surface-900">
          No clients yet
        </h2>
        <p className="mt-2 text-surface-600 max-w-md mx-auto">
          Start by searching your local area for businesses without websites, or skip
          ahead and add a client you already have.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/app/leads"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand pl-6 pr-4 text-sm font-medium text-brand-fg shadow-soft active:scale-[0.98] transition"
          >
            Find leads
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <Link
            href="/app/clients/new"
            className="inline-flex h-12 items-center rounded-full border border-surface-300 bg-white px-6 text-sm font-medium text-surface-800 hover:bg-surface-100 transition"
          >
            Add client manually
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5">
      <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl text-surface-900 tabular-nums">{value}</div>
      {sublabel && <div className="text-xs text-surface-500 mt-1 capitalize">{sublabel}</div>}
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-surface-200 bg-white p-6 shadow-soft hover:shadow-elevated transition-all"
    >
      <div className="h-10 w-10 grid place-items-center rounded-full bg-brand/10 text-brand">
        {icon}
      </div>
      <div className="mt-4 font-display text-xl text-surface-900">{title}</div>
      <p className="mt-1 text-sm text-surface-600">{description}</p>
      <div className="mt-4 text-sm font-medium text-brand inline-flex items-center gap-1.5 group-hover:gap-2 transition-all">
        {cta} <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
