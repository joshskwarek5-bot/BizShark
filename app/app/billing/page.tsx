import { redirect } from "next/navigation";
import { CreditCard, CalendarClock } from "lucide-react";
import { requireOperator } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function OperatorBillingPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const trialDaysLeft = operator.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((operator.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-surface-900">Billing</h1>
        <p className="text-sm text-surface-500 mt-1">
          Your subscription, plan limits, and invoices.
        </p>
      </div>

      <div className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-surface-500">
              Current plan
            </div>
            <div className="mt-2 font-display text-3xl text-surface-900 capitalize">
              {operator.subscriptionTier}
            </div>
            <div className="mt-1 text-sm text-surface-600 capitalize">
              {operator.subscriptionStatus}
            </div>
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
      </div>

      <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
          <CreditCard className="h-6 w-6" />
        </div>
        <div className="mt-4 font-display text-2xl text-surface-900">
          Subscription billing coming soon
        </div>
        <p className="mt-2 text-surface-600 max-w-md mx-auto text-sm">
          Stripe subscription tiers (Starter / Pro / Agency), trial-to-paid flow, lookup
          limits, and the customer portal will land in Phase 5.
        </p>
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3.5 py-1.5 text-xs font-medium text-surface-700">
          Phase 5
        </div>
      </div>
    </div>
  );
}
