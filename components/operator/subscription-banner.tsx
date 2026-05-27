import Link from "next/link";
import { CalendarClock, AlertTriangle, ArrowRight } from "lucide-react";
import { type TierId } from "@/lib/subscriptions";

interface Props {
  status: string;
  trialDaysLeft: number | null;
  tier: TierId;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

/**
 * Banner shown at the top of every /app page when the operator's subscription
 * needs attention — trial ending soon, past due, or canceled. Stays out of
 * the way when status is healthy.
 */
export function SubscriptionBanner({
  status,
  trialDaysLeft,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: Props) {
  // Trial countdown — always shown while status is "trial" so it's
  // impossible to miss. Tone escalates: brand → amber (≤1 day) → red (0).
  if (status === "trial") {
    if (trialDaysLeft === null) return null;

    if (trialDaysLeft <= 0) {
      return (
        <TrialBar tone="danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Your free trial has ended.</strong> Subscribe to keep building sites
            and searching for leads.
          </span>
          <UpgradeBtn tone="danger" label="Upgrade now" />
        </TrialBar>
      );
    }

    if (trialDaysLeft <= 1) {
      return (
        <TrialBar tone="warning">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span>
            <strong>Last day of your free trial.</strong> Pick a plan to keep going
            without a break.
          </span>
          <UpgradeBtn tone="warning" label="Upgrade" />
        </TrialBar>
      );
    }

    return (
      <TrialBar tone="brand">
        <CalendarClock className="h-4 w-4 shrink-0" />
        <span>
          <strong>
            {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in your free trial
          </strong>{" "}
          — get your first paying client before it ends.
        </span>
        <UpgradeBtn tone="brand" label="Upgrade" />
      </TrialBar>
    );
  }

  if (status === "past_due") {
    return (
      <Banner tone="warning">
        <AlertTriangle className="h-4 w-4" />
        <strong>Your last payment failed.</strong> Update your payment method to keep
        access from being suspended.
        <CTA href="/app/billing">Fix billing</CTA>
      </Banner>
    );
  }

  if (status === "canceled") {
    const stillActive = currentPeriodEnd && currentPeriodEnd > new Date();
    if (stillActive) {
      return (
        <Banner tone="info">
          <CalendarClock className="h-4 w-4" />
          <strong>
            Subscription canceled — access ends {currentPeriodEnd.toLocaleDateString()}.
          </strong>{" "}
          Want to keep going?
          <CTA href="/app/billing">Resubscribe</CTA>
        </Banner>
      );
    }
    return (
      <Banner tone="danger">
        <AlertTriangle className="h-4 w-4" />
        <strong>Subscription ended.</strong> You can browse your data but can&apos;t
        create new clients or search leads.
        <CTA href="/app/billing">Resubscribe</CTA>
      </Banner>
    );
  }

  if (status === "active" && cancelAtPeriodEnd && currentPeriodEnd) {
    return (
      <Banner tone="info">
        <CalendarClock className="h-4 w-4" />
        <strong>Subscription set to cancel</strong> on{" "}
        {currentPeriodEnd.toLocaleDateString()}.
        <CTA href="/app/billing">Keep subscription</CTA>
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  children,
}: {
  tone: "warning" | "info" | "danger";
  children: React.ReactNode;
}) {
  const classes =
    tone === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : tone === "danger"
        ? "bg-red-50 border-red-200 text-red-900"
        : "bg-sky-50 border-sky-200 text-sky-900";
  return (
    <div
      className={`border-b px-4 sm:px-6 lg:px-10 py-3 text-sm flex items-center justify-between gap-3 flex-wrap ${classes}`}
    >
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function CTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 ml-auto rounded-full bg-surface-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-surface-700 transition"
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function TrialBar({
  tone,
  children,
}: {
  tone: "brand" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const classes =
    tone === "warning"
      ? "bg-amber-100 border-amber-300 text-amber-900"
      : tone === "danger"
        ? "bg-red-600 border-red-700 text-white"
        : "bg-brand text-brand-fg border-brand";
  return (
    <div
      className={`border-b px-4 sm:px-6 lg:px-10 py-2 text-xs sm:text-sm flex items-center gap-3 flex-wrap ${classes}`}
    >
      {children}
    </div>
  );
}

function UpgradeBtn({
  tone,
  label,
}: {
  tone: "brand" | "warning" | "danger";
  label: string;
}) {
  const classes =
    tone === "warning"
      ? "bg-amber-900 text-white hover:bg-amber-950"
      : tone === "danger"
        ? "bg-white text-red-700 hover:bg-red-50"
        : "bg-white/15 text-brand-fg hover:bg-white/25 ring-1 ring-white/30";
  return (
    <Link
      href="/app/billing"
      className={`inline-flex items-center gap-1.5 ml-auto rounded-full px-3 py-1 text-xs font-semibold transition ${classes}`}
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
