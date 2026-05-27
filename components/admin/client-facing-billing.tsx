"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  CreditCard,
  Repeat,
  Receipt,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clientSyncBilling } from "@/app/r/[slug]/admin/(panel)/billing/actions";

interface InvoiceRow {
  id: string;
  amountCents: number;
  status: string;
  description: string | null;
  hostedUrl: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface Props {
  slug: string;
  restaurantName: string;
  providerName: string;
  providerPhone: string | null;
  mode: string;
  monthlyAmountCents: number | null;
  percentageBps: number | null;
  hasActiveSubscription: boolean;
  pendingCheckoutUrl: string | null;
  subscriptionStatus: string;
  invoices: InvoiceRow[];
  checkoutFlash: "success" | "canceled" | null;
}

export function ClientFacingBilling({
  slug,
  restaurantName,
  providerName,
  providerPhone,
  mode,
  monthlyAmountCents,
  percentageBps,
  hasActiveSubscription,
  pendingCheckoutUrl,
  subscriptionStatus,
  invoices,
  checkoutFlash,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    if (checkoutFlash === "success") {
      toast.success("You're subscribed", {
        description: "Card on file — invoices will appear here automatically.",
      });
      // Auto-sync to pull the freshly-created subscription/invoice
      void onSync();
    } else if (checkoutFlash === "canceled") {
      toast.message("Subscription not started");
    }
    if (checkoutFlash) {
      const url = new URL(window.location.href);
      url.searchParams.delete("subscribed");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutFlash]);

  async function onSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await clientSyncBilling({ slug });
      if (res.ok) {
        if ("updatedInvoices" in res && res.updatedInvoices > 0) {
          toast.success(
            `Refreshed — ${res.updatedInvoices} update${res.updatedInvoices === 1 ? "" : "s"}`
          );
        }
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Refresh failed");
      }
    } finally {
      setSyncing(false);
    }
  }

  // Re-sync when arriving from the public site via search-param signal
  React.useEffect(() => {
    const refresh = searchParams.get("refresh");
    if (refresh === "1") {
      void onSync();
      const url = new URL(window.location.href);
      url.searchParams.delete("refresh");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outstanding = invoices.filter(
    (i) => i.status === "open" || i.status === "draft"
  );
  const paidTotal = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amountCents, 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            Billing
          </div>
          <h1 className="mt-2 font-display text-4xl text-surface-900">
            Billing &amp; invoices
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Anything you owe {providerName} for the {restaurantName} website.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Hero: outstanding amount or subscription status */}
      {outstanding.length > 0 ? (
        <PayCallout outstanding={outstanding} total={outstandingTotal} />
      ) : hasActiveSubscription ? (
        <ActiveSubscriptionCallout
          amountCents={monthlyAmountCents ?? 0}
          status={subscriptionStatus}
        />
      ) : pendingCheckoutUrl ? (
        <PendingSubscriptionCallout
          url={pendingCheckoutUrl}
          amountCents={monthlyAmountCents ?? 0}
        />
      ) : (
        <NothingOwedCallout paidTotal={paidTotal} />
      )}

      {/* Plan summary */}
      <section className="mt-6 rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-7">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-surface-500 mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          Your plan
        </div>
        <PlanSummary
          mode={mode}
          monthlyAmountCents={monthlyAmountCents}
          percentageBps={percentageBps}
          providerName={providerName}
          providerPhone={providerPhone}
        />
      </section>

      {/* History */}
      <section className="mt-8 rounded-3xl border border-surface-200 bg-white shadow-soft overflow-hidden">
        <header className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
          <h2 className="font-display text-xl text-surface-900">
            Invoice history
          </h2>
          <div className="text-xs text-surface-500">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
          </div>
        </header>
        {invoices.length === 0 ? (
          <div className="p-10 text-center text-sm text-surface-500">
            No invoices yet.
          </div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {invoices.map((inv) => (
              <ClientInvoiceRow key={inv.id} invoice={inv} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PayCallout({
  outstanding,
  total,
}: {
  outstanding: InvoiceRow[];
  total: number;
}) {
  const top = outstanding[0];
  return (
    <section className="rounded-3xl bg-gradient-to-br from-brand to-brand p-1 shadow-elevated">
      <div className="rounded-[20px] bg-white p-7 md:p-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-brand">
              You owe
            </div>
            <div className="mt-2 font-mono font-display text-5xl tabular-nums text-surface-900">
              {formatMoney(total)}
            </div>
            <div className="mt-2 text-sm text-surface-600">
              Across {outstanding.length} unpaid invoice
              {outstanding.length === 1 ? "" : "s"}.
              {top.dueAt && (
                <>
                  {" "}
                  Earliest due{" "}
                  <strong>{new Date(top.dueAt).toLocaleDateString()}</strong>.
                </>
              )}
            </div>
          </div>
          {top.hostedUrl && (
            <a
              href={top.hostedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-14 items-center gap-2 rounded-full bg-brand text-brand-fg px-7 text-base font-medium shadow-soft hover:brightness-105 transition"
            >
              <CreditCard className="h-5 w-5" />
              Pay {formatMoney(top.amountCents)} now
            </a>
          )}
        </div>
        {outstanding.length > 1 && (
          <p className="mt-4 text-xs text-surface-500">
            Pay each invoice individually below — Stripe handles cards, Apple Pay,
            and bank transfer.
          </p>
        )}
      </div>
    </section>
  );
}

function ActiveSubscriptionCallout({
  amountCents,
  status,
}: {
  amountCents: number;
  status: string;
}) {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white shadow-soft p-7 md:p-9">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 grid place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Repeat className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-700">
            Monthly subscription
          </div>
          <div className="mt-1 font-display text-3xl text-surface-900">
            {formatMoney(amountCents)} <span className="text-base text-surface-500">/ month</span>
          </div>
        </div>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
            status === "active"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : status === "canceled"
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-amber-50 text-amber-700 ring-amber-200"
          )}
        >
          {status}
        </span>
      </div>
      <p className="text-sm text-surface-600">
        Your card on file is charged automatically each month. New invoices appear
        below as Stripe processes them.
      </p>
    </section>
  );
}

function PendingSubscriptionCallout({
  url,
  amountCents,
}: {
  url: string;
  amountCents: number;
}) {
  return (
    <section className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white shadow-soft p-7 md:p-9">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="h-10 w-10 grid place-items-center rounded-full bg-sky-100 text-sky-700">
          <Repeat className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono uppercase tracking-widest text-sky-700">
            Subscription pending
          </div>
          <div className="mt-1 font-display text-2xl text-surface-900">
            Start your {formatMoney(amountCents)}/mo subscription
          </div>
          <p className="mt-2 text-sm text-surface-600">
            Enter your card once — Stripe handles secure billing every month after.
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-sky-600 text-white px-6 text-sm font-medium shadow-soft hover:brightness-105 transition"
        >
          <CreditCard className="h-4 w-4" /> Start subscription
        </a>
      </div>
    </section>
  );
}

function NothingOwedCallout({ paidTotal }: { paidTotal: number }) {
  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-7 md:p-9 flex items-center gap-4">
      <div className="h-12 w-12 grid place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <div>
        <div className="font-display text-2xl text-surface-900">All paid up</div>
        <p className="text-sm text-surface-600 mt-1">
          {paidTotal > 0
            ? `${formatMoney(paidTotal)} paid in full so far. Anything new will show up here.`
            : "Nothing is owed right now. Future invoices will show up here."}
        </p>
      </div>
    </section>
  );
}

function PlanSummary({
  mode,
  monthlyAmountCents,
  percentageBps,
  providerName,
  providerPhone,
}: {
  mode: string;
  monthlyAmountCents: number | null;
  percentageBps: number | null;
  providerName: string;
  providerPhone: string | null;
}) {
  const planDesc =
    mode === "monthly" && monthlyAmountCents
      ? `${formatMoney(monthlyAmountCents)}/mo recurring`
      : mode === "revenue_share" && percentageBps
        ? `${(percentageBps / 100).toFixed(1)}% of online order sales, billed monthly`
        : mode === "one_time"
          ? "One-time invoices as services are delivered"
          : "Custom — see invoices below";
  return (
    <div className="grid sm:grid-cols-3 gap-5">
      <div className="sm:col-span-2 space-y-1.5">
        <div className="font-display text-xl text-surface-900">{planDesc}</div>
        <p className="text-sm text-surface-600">
          Billed by <strong>{providerName}</strong> via Stripe. Payments go directly
          to them — secure card processing, automatic receipts.
        </p>
      </div>
      <div className="rounded-2xl bg-surface-50 ring-1 ring-surface-200 p-4 text-xs text-surface-600 space-y-1">
        <div className="font-medium text-surface-700 mb-1">Questions?</div>
        <div>Contact {providerName}</div>
        {providerPhone && (
          <a
            href={`tel:${providerPhone}`}
            className="text-brand hover:underline block"
          >
            {providerPhone}
          </a>
        )}
      </div>
    </div>
  );
}

function ClientInvoiceRow({ invoice }: { invoice: InvoiceRow }) {
  const tone = statusTone(invoice.status);
  const Icon =
    invoice.status === "paid"
      ? CheckCircle2
      : invoice.status === "open"
        ? Clock
        : invoice.status === "void" || invoice.status === "uncollectible"
          ? AlertCircle
          : Receipt;
  const canPay = invoice.status === "open" || invoice.status === "draft";
  return (
    <li className="px-6 py-4 flex items-center gap-4 flex-wrap">
      <div className={`h-9 w-9 grid place-items-center rounded-full ${tone.bg} ${tone.text}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono tabular-nums text-lg text-surface-900">
          {formatMoney(invoice.amountCents)}
        </div>
        <div className="text-xs text-surface-500 truncate">
          {invoice.description ?? "—"} ·{" "}
          {new Date(invoice.createdAt).toLocaleDateString()}
          {invoice.dueAt && invoice.status !== "paid" && (
            <> · due {new Date(invoice.dueAt).toLocaleDateString()}</>
          )}
          {invoice.paidAt && invoice.status === "paid" && (
            <> · paid {new Date(invoice.paidAt).toLocaleDateString()}</>
          )}
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
      >
        {invoice.status}
      </span>
      {canPay && invoice.hostedUrl ? (
        <a
          href={invoice.hostedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand text-brand-fg px-4 text-xs font-medium shadow-soft hover:brightness-105 transition"
        >
          <CreditCard className="h-3.5 w-3.5" /> Pay now
        </a>
      ) : invoice.hostedUrl ? (
        <a
          href={invoice.hostedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          View receipt <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </li>
  );
}

function statusTone(s: string): { bg: string; text: string; ring: string } {
  switch (s) {
    case "paid":
      return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" };
    case "open":
      return { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" };
    case "void":
    case "uncollectible":
      return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" };
    case "draft":
    default:
      return { bg: "bg-surface-100", text: "text-surface-600", ring: "ring-surface-200" };
  }
}
