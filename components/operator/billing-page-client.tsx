"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  CalendarClock,
  ExternalLink,
  CreditCard,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TIER_IDS, TIERS, type TierDefinition, type TierId } from "@/lib/subscriptions";
import {
  openCustomerPortal,
  refreshSubscriptionStatus,
  startSubscriptionCheckout,
} from "@/app/app/billing/actions";

interface CurrentPlan {
  tier: TierId;
  status: string;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null; // ISO
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
}

interface Props {
  current: CurrentPlan;
  billingConfigured: boolean;
}

export function BillingPageClient({ current, billingConfigured }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [upgrading, setUpgrading] = React.useState<TierId | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(false);

  // Handle return from Stripe Checkout
  React.useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout) return;
    if (checkout === "success") {
      toast.success("Subscription updated", {
        description: "Welcome aboard — your access is live.",
      });
      // Reconcile the local state
      refreshSubscriptionStatus().then(() => router.refresh());
    } else if (checkout === "canceled") {
      toast.message("Checkout canceled — no changes made");
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams, router]);

  async function onUpgrade(tier: TierId) {
    setUpgrading(tier);
    try {
      const res = await startSubscriptionCheckout({ tier });
      if (res.ok) {
        window.location.href = res.url;
      } else {
        toast.error(res.error);
        setUpgrading(null);
      }
    } catch {
      toast.error("Could not start checkout");
      setUpgrading(null);
    }
  }

  async function onPortal() {
    setPortalLoading(true);
    try {
      const res = await openCustomerPortal();
      if (res.ok) {
        window.open(res.url, "_blank");
      } else {
        toast.error(res.error);
      }
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <>
      <CurrentPlanCard plan={current} onPortal={onPortal} portalLoading={portalLoading} />

      {!billingConfigured && (
        <div className="mt-6 rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <div className="font-medium">Subscription billing isn&apos;t configured yet</div>
            <p className="mt-1">
              The platform admin needs to create three products in Stripe (Starter, Pro,
              Agency) and set <code className="text-xs">STRIPE_PRICE_STARTER</code>,{" "}
              <code className="text-xs">STRIPE_PRICE_PRO</code>,{" "}
              <code className="text-xs">STRIPE_PRICE_AGENCY</code> environment variables.
              You can keep using the platform on your trial until then.
            </p>
          </div>
        </div>
      )}

      <div className="mt-10 mb-6 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-brand">
          Choose your plan
        </div>
        <h2 className="mt-2 font-display text-3xl md:text-4xl text-surface-900">
          Pay yourself first
        </h2>
        <p className="mt-3 text-sm text-surface-600 max-w-lg mx-auto">
          Charge clients whatever you want — we don&apos;t take a cut. The subscription
          covers your platform access.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {TIER_IDS.map((id) => (
          <TierCard
            key={id}
            tier={TIERS[id]}
            isCurrent={current.tier === id && current.status !== "canceled"}
            disabled={!billingConfigured || upgrading !== null}
            loading={upgrading === id}
            onUpgrade={() => onUpgrade(id)}
          />
        ))}
      </div>
    </>
  );
}

function CurrentPlanCard({
  plan,
  onPortal,
  portalLoading,
}: {
  plan: CurrentPlan;
  onPortal: () => void;
  portalLoading: boolean;
}) {
  const tier = TIERS[plan.tier];
  const statusTone =
    plan.status === "trial"
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : plan.status === "active"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
        : plan.status === "past_due"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : plan.status === "canceled"
            ? "bg-red-50 text-red-700 ring-red-200"
            : "bg-surface-100 text-surface-700 ring-surface-200";

  return (
    <div className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-surface-500">
            Current plan
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="font-display text-3xl text-surface-900">{tier.name}</div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
                statusTone
              )}
            >
              {plan.status.replace("_", " ")}
            </span>
          </div>
          <div className="mt-3 text-sm text-surface-600">
            ${tier.priceMonthly}/mo · {tier.leadLookupsPerMonth.toLocaleString()} lookups
            · {tier.maxClients === null ? "Unlimited" : `Up to ${tier.maxClients}`} clients
          </div>
        </div>
        <div className="space-y-2 text-sm text-right">
          {plan.status === "trial" && plan.trialDaysLeft !== null && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 ring-1 ring-amber-200 px-3.5 py-1.5 text-xs font-medium text-amber-800">
              <CalendarClock className="h-3.5 w-3.5" />
              {plan.trialDaysLeft > 0
                ? `${plan.trialDaysLeft} day${plan.trialDaysLeft === 1 ? "" : "s"} left in trial`
                : "Trial ended"}
            </div>
          )}
          {plan.currentPeriodEnd && plan.status === "active" && (
            <div className="text-xs text-surface-600">
              {plan.cancelAtPeriodEnd ? "Cancels on " : "Renews on "}
              {new Date(plan.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
      {plan.hasStripeCustomer && (
        <div className="mt-6 pt-5 border-t border-surface-100 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onPortal} disabled={portalLoading}>
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Manage in Stripe portal
          </Button>
          <span className="text-xs text-surface-500 self-center">
            Change payment method, swap plans, view invoices, or cancel.
          </span>
        </div>
      )}
    </div>
  );
}

function TierCard({
  tier,
  isCurrent,
  disabled,
  loading,
  onUpgrade,
}: {
  tier: TierDefinition;
  isCurrent: boolean;
  disabled: boolean;
  loading: boolean;
  onUpgrade: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl p-8 relative flex flex-col",
        tier.featured
          ? "bg-surface-900 text-surface-50 shadow-elevated"
          : "border border-surface-200 bg-white"
      )}
    >
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-brand-fg">
          Most popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
          <Sparkles className="h-2.5 w-2.5" /> Current
        </div>
      )}
      <div className="font-display text-2xl">{tier.name}</div>
      <div className={cn("mt-1 text-sm", tier.featured ? "opacity-70" : "text-surface-600")}>
        {tier.blurb}
      </div>
      <div className="mt-6">
        <span className="font-display text-5xl">${tier.priceMonthly}</span>
        <span className={cn("ml-2 text-sm", tier.featured ? "opacity-70" : "text-surface-600")}>
          per month
        </span>
      </div>
      <ul className="mt-6 space-y-2 text-sm flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              className={cn(
                "h-4 w-4 shrink-0 mt-0.5",
                tier.featured ? "text-emerald-300" : "text-emerald-600"
              )}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onUpgrade}
        disabled={disabled || isCurrent}
        className={cn(
          "mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition",
          tier.featured
            ? "bg-brand text-brand-fg shadow-soft hover:brightness-105 disabled:opacity-50"
            : "border border-surface-900 bg-transparent text-surface-900 hover:bg-surface-900 hover:text-surface-50 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-surface-900"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Opening Stripe…
          </>
        ) : isCurrent ? (
          "Your current plan"
        ) : (
          <>
            <CreditCard className="h-4 w-4" /> Subscribe
          </>
        )}
      </button>
    </div>
  );
}
