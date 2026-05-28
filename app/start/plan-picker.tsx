"use client";

import { useState } from "react";
import { Check, Zap, Building2, Briefcase } from "lucide-react";
import { TIERS, type TierId } from "@/lib/subscriptions";
import { startTrialCheckout } from "./actions";

const TIER_ICONS: Record<TierId, React.ReactNode> = {
  starter: <Zap className="h-5 w-5" />,
  pro: <Briefcase className="h-5 w-5" />,
  agency: <Building2 className="h-5 w-5" />,
};

export function PlanPicker({ canceled }: { canceled?: boolean }) {
  const [loading, setLoading] = useState<TierId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(tier: TierId) {
    setLoading(tier);
    setError(null);
    try {
      const res = await startTrialCheckout({ tier });
      if (!res.ok) {
        setError(res.error);
        setLoading(null);
        return;
      }
      window.location.href = res.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {canceled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout was canceled — pick a plan whenever you're ready.
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {(["starter", "pro", "agency"] as TierId[]).map((tierId) => {
          const tier = TIERS[tierId];
          const isFeatured = tier.featured;
          return (
            <div
              key={tierId}
              className={[
                "relative flex flex-col rounded-3xl border p-6 transition-shadow",
                isFeatured
                  ? "border-brand bg-brand/5 shadow-lg ring-1 ring-brand/20"
                  : "border-surface-200 bg-white hover:shadow-md",
              ].join(" ")}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-4 flex items-center gap-2">
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    isFeatured ? "bg-brand text-white" : "bg-surface-100 text-surface-600",
                  ].join(" ")}
                >
                  {TIER_ICONS[tierId]}
                </span>
                <span className="font-display text-lg text-surface-900">{tier.name}</span>
              </div>

              <div className="mb-1 flex items-end gap-1">
                <span className="font-display text-4xl text-surface-900">${tier.priceMonthly}</span>
                <span className="mb-1 text-sm text-surface-500">/mo</span>
              </div>
              <p className="mb-5 text-sm text-surface-500">{tier.blurb}</p>

              <ul className="mb-6 flex-1 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-surface-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(tierId)}
                disabled={loading !== null}
                className={[
                  "w-full rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
                  isFeatured
                    ? "bg-brand text-white hover:bg-brand/90"
                    : "bg-surface-900 text-white hover:bg-surface-800",
                ].join(" ")}
              >
                {loading === tierId ? "Redirecting…" : "Start 3-day free trial"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-surface-400">
        Card required · Trial ends automatically after 3 days · Cancel anytime
      </p>
    </div>
  );
}
