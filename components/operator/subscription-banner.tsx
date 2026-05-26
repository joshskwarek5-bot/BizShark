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
  // Trial ending soon
  if (status === "trial") {
    if (trialDaysLeft === null) return null;
    if (trialDaysLeft <= 0) {
      return (
        <Banner tone="warning">
          <AlertTriangle className="h-4 w-4" />
          <strong>Your trial has ended.</strong> Subscribe to keep building sites and
          searching for leads.
          <CTA href="/app/billing">Subscribe now</CTA>
        </Banner>
      );
    }
    if (trialDaysLeft <= 3) {
      return (
        <Banner tone="warning">
          <CalendarClock className="h-4 w-4" />
          <strong>
            {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in your trial.
          </strong>{" "}
          Subscribe now to avoid an interruption.
          <CTA href="/app/billing">Pick a plan</CTA>
        </Banner>
      );
    }
    // Healthy trial — quiet banner
    return (
      <div className="bg-sky-50 border-b border-sky-100 px-4 sm:px-6 lg:px-10 py-2 text-xs text-sky-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {trialDaysLeft} days left in your free trial.
        </div>
        <Link
          href="/app/billing"
          className="font-medium underline hover:no-underline inline-flex items-center gap-1"
        >
          Pick a plan <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
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
