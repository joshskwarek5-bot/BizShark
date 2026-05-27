"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Circle,
  ImageIcon,
  ChefHat,
  CreditCard,
  Clock,
  Phone,
  Sparkles,
  Rocket,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReadinessSnapshot {
  hasHero: boolean;
  hasLogo: boolean;
  menuItemCount: number;
  hasCategories: boolean;
  stripeStatus: string; // none | pending | active | restricted
  stripeChargesEnabled: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasAddress: boolean;
  hasHoursSet: boolean;
  hasOrders: boolean; // any test or real order completed
}

interface Props {
  slug: string;
  restaurantName: string;
  snapshot: ReadinessSnapshot;
}

interface Step {
  key: string;
  label: string;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  fixHref: string;
  fixLabel: string;
  /** Critical = must be done before pitching. Non-critical = nice-to-have. */
  critical: boolean;
}

export function RestaurantReadinessCard({
  slug,
  restaurantName,
  snapshot,
}: Props) {
  const steps: Step[] = [
    {
      key: "hero",
      label: "Hero image set",
      done: snapshot.hasHero,
      icon: ImageIcon,
      fixHref: `/r/${slug}/admin/settings`,
      fixLabel: "Add hero",
      critical: true,
    },
    {
      key: "menu",
      label: `Menu items (${snapshot.menuItemCount} so far — need 5+)`,
      done: snapshot.menuItemCount >= 5,
      icon: ChefHat,
      fixHref: `/r/${slug}/admin/menu`,
      fixLabel: snapshot.menuItemCount === 0 ? "Import menu" : "Add more",
      critical: true,
    },
    {
      key: "stripe",
      label:
        snapshot.stripeStatus === "active"
          ? "Stripe — accepting card payments"
          : snapshot.stripeStatus === "pending"
            ? "Stripe — owner needs to finish onboarding"
            : snapshot.stripeStatus === "restricted"
              ? "Stripe — restricted (action needed)"
              : "Stripe — not connected yet",
      done: snapshot.stripeStatus === "active" && snapshot.stripeChargesEnabled,
      icon: CreditCard,
      fixHref: `/app/clients/${slug}#stripe-card`,
      fixLabel: snapshot.stripeStatus === "none" ? "Set up Stripe" : "Sync status",
      critical: true,
    },
    {
      key: "hours",
      label: "Hours configured",
      done: snapshot.hasHoursSet,
      icon: Clock,
      fixHref: `/r/${slug}/admin/settings`,
      fixLabel: "Set hours",
      critical: true,
    },
    {
      key: "contact",
      label: "Phone + address on file",
      done: snapshot.hasPhone && snapshot.hasAddress,
      icon: Phone,
      fixHref: `/r/${slug}/admin/settings`,
      fixLabel: "Add contact",
      critical: true,
    },
    {
      key: "logo",
      label: "Logo uploaded (optional)",
      done: snapshot.hasLogo,
      icon: ImageIcon,
      fixHref: `/r/${slug}/admin/settings`,
      fixLabel: "Add logo",
      critical: false,
    },
    {
      key: "test-order",
      label: "Place a test order to verify the kitchen flow",
      done: snapshot.hasOrders,
      icon: Rocket,
      fixHref: `/app/clients/${slug}/tour`,
      fixLabel: "Run test order",
      critical: false,
    },
  ];

  const criticalSteps = steps.filter((s) => s.critical);
  const criticalDone = criticalSteps.filter((s) => s.done).length;
  const allDone = criticalDone === criticalSteps.length;
  const totalDone = steps.filter((s) => s.done).length;
  const pct = Math.round((totalDone / steps.length) * 100);

  return (
    <section
      className={cn(
        "rounded-3xl border-2 shadow-soft overflow-hidden",
        allDone
          ? "border-emerald-300"
          : criticalDone >= criticalSteps.length - 1
            ? "border-amber-300"
            : "border-surface-200"
      )}
    >
      <div
        className={cn(
          "p-6 md:p-8 flex items-center gap-5 flex-wrap",
          allDone
            ? "bg-gradient-to-br from-emerald-50 via-white to-white"
            : "bg-gradient-to-br from-brand/5 via-white to-white"
        )}
      >
        <div
          className={cn(
            "h-14 w-14 grid place-items-center rounded-2xl shrink-0",
            allDone ? "bg-emerald-500 text-white" : "bg-brand text-brand-fg"
          )}
        >
          {allDone ? <Rocket className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-2xl text-surface-900">
              {allDone
                ? `${restaurantName} is ready to pitch`
                : `${restaurantName} setup`}
            </h2>
            <span className="text-xs font-medium tabular-nums text-surface-500">
              {criticalDone}/{criticalSteps.length} required · {totalDone}/{steps.length} total
            </span>
          </div>
          <p className="mt-1 text-sm text-surface-600">
            {allDone
              ? "Walk in, show them the live site, place a test order. Sign them up."
              : "Complete the required steps below before walking into the shop."}
          </p>
        </div>
        <div className="hidden sm:block w-32">
          <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                allDone ? "bg-emerald-500" : "bg-brand"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-surface-500 text-right">
            {pct}% complete
          </div>
        </div>
      </div>

      <ul className="divide-y divide-surface-100">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.key}
              className={cn(
                "px-6 md:px-8 py-3 flex items-center gap-4 group",
                s.done
                  ? "bg-emerald-50/30"
                  : s.critical
                    ? "bg-white"
                    : "bg-surface-50/30 opacity-90"
              )}
            >
              <div
                className={cn(
                  "h-7 w-7 grid place-items-center rounded-full shrink-0 ring-1",
                  s.done
                    ? "bg-emerald-500 text-white ring-emerald-500"
                    : s.critical
                      ? "bg-white text-surface-500 ring-surface-300"
                      : "bg-surface-100 text-surface-400 ring-surface-200"
                )}
              >
                {s.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  s.done ? "text-emerald-600" : "text-surface-400"
                )}
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  s.done ? "text-surface-700" : "text-surface-900",
                  !s.critical && "italic text-surface-500"
                )}
              >
                {s.label}
                {!s.critical && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-surface-400">
                    optional
                  </span>
                )}
              </span>
              {!s.done && (
                <Link
                  href={s.fixHref}
                  className="text-xs font-medium text-brand hover:underline shrink-0 inline-flex items-center gap-1"
                >
                  {s.fixLabel} →
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {!allDone && (
        <div className="px-6 md:px-8 py-4 bg-amber-50 ring-1 ring-amber-200 border-t border-amber-100 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
          <span>
            Don&apos;t walk into the restaurant before all{" "}
            <strong>{criticalSteps.length} required</strong> steps are green —
            you&apos;ll lose the pitch the second they ask a question and
            something doesn&apos;t work.
          </span>
        </div>
      )}
    </section>
  );
}
