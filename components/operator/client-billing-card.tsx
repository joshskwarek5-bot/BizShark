"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Percent,
  CreditCard,
  Calendar,
  Send,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  Link2,
  Zap,
  X,
  Repeat,
  Ban,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BILLING_MODES, BILLING_MODE_META, type BillingMode } from "@/lib/client-billing";
import {
  cancelClientSubscription,
  createOneTimeInvoice,
  refreshInvoiceStatus,
  startMonthlySubscription,
  syncBillingFromStripe,
  upsertClientBilling,
} from "@/app/app/clients/[slug]/billing/actions";

interface BillingState {
  mode: BillingMode;
  amountDollars: string;
  percentage: string;
  description: string;
  clientBillingEmail: string;
  clientBillingName: string;
}

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
  restaurantEmail: string | null;
  initial: {
    mode: BillingMode | null;
    amountCents: number | null;
    percentageBps: number | null;
    description: string | null;
    clientBillingEmail: string | null;
    clientBillingName: string | null;
    status: string;
    stripeSubscriptionId: string | null;
    pendingCheckoutUrl: string | null;
  } | null;
  invoices: InvoiceRow[];
  hasOperatorStripe: boolean;
}

export function ClientBillingCard({
  slug,
  restaurantName,
  restaurantEmail,
  initial,
  invoices,
  hasOperatorStripe,
}: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState<BillingState>({
    mode: (initial?.mode as BillingMode) ?? "one_time",
    amountDollars: initial?.amountCents != null ? (initial.amountCents / 100).toFixed(2) : "",
    percentage:
      initial?.percentageBps != null ? (initial.percentageBps / 100).toString() : "",
    description: initial?.description ?? "",
    clientBillingEmail: initial?.clientBillingEmail ?? "",
    clientBillingName: initial?.clientBillingName ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Quick-charge state
  const initialAmount =
    initial?.mode === "one_time" && initial.amountCents
      ? (initial.amountCents / 100).toFixed(2)
      : initial?.amountCents
        ? (initial.amountCents / 100).toFixed(2)
        : "";
  const [chargeAmount, setChargeAmount] = React.useState(initialAmount);
  const [chargeDesc, setChargeDesc] = React.useState(
    initial?.description ?? `Website services for ${restaurantName}`
  );
  const [chargeEmail, setChargeEmail] = React.useState(true);
  const [charging, setCharging] = React.useState(false);
  const [shareLink, setShareLink] = React.useState<{
    url: string;
    amountCents: number;
    description: string;
    emailed: boolean;
    kind: "invoice" | "subscription";
  } | null>(null);

  // Subscription
  const [startingSub, setStartingSub] = React.useState(false);
  const [cancelingSub, setCancelingSub] = React.useState(false);
  const hasActiveSub = !!initial?.stripeSubscriptionId;

  async function onSave() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await upsertClientBilling({
        slug,
        mode: form.mode,
        amountDollars:
          form.mode !== "revenue_share" && form.amountDollars
            ? parseFloat(form.amountDollars)
            : undefined,
        percentage:
          form.mode === "revenue_share" && form.percentage
            ? parseFloat(form.percentage)
            : undefined,
        description: form.description || null,
        clientBillingEmail: form.clientBillingEmail || null,
        clientBillingName: form.clientBillingName || null,
      });
      if (res.ok) {
        toast.success("Billing saved");
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not save");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onCharge() {
    if (charging) return;
    if (!hasOperatorStripe) {
      toast.error("Add your Stripe secret key in Settings first");
      return;
    }
    const amount = parseFloat(chargeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setCharging(true);
    try {
      const res = await createOneTimeInvoice({
        slug,
        amountDollars: amount,
        description: chargeDesc.trim() || undefined,
        sendEmail: chargeEmail,
      });
      if (res.ok && res.hostedUrl) {
        setShareLink({
          url: res.hostedUrl,
          amountCents: Math.round(amount * 100),
          description: chargeDesc.trim() || `Website services for ${restaurantName}`,
          emailed: res.emailed,
          kind: "invoice",
        });
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not charge");
      }
    } finally {
      setCharging(false);
    }
  }

  async function onSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncBillingFromStripe({ slug });
      if (res.ok) {
        toast.success(
          res.updatedInvoices > 0
            ? `Synced — ${res.updatedInvoices} update${res.updatedInvoices === 1 ? "" : "s"}`
            : "Up to date"
        );
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function onStartSubscription() {
    if (startingSub) return;
    if (!hasOperatorStripe) {
      toast.error("Add your Stripe secret key in Settings first");
      return;
    }
    const amount = parseFloat(form.amountDollars);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Set a monthly amount and save first");
      return;
    }
    setStartingSub(true);
    try {
      const res = await startMonthlySubscription({ slug, amountDollars: amount });
      if (res.ok && res.url) {
        setShareLink({
          url: res.url,
          amountCents: Math.round(amount * 100),
          description: form.description.trim() || `Monthly website services — ${restaurantName}`,
          emailed: false,
          kind: "subscription",
        });
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not start subscription");
      }
    } finally {
      setStartingSub(false);
    }
  }

  async function onCancelSubscription() {
    if (!confirm("Cancel the recurring subscription? They will not be billed again.")) return;
    setCancelingSub(true);
    try {
      const res = await cancelClientSubscription({ slug });
      if (res.ok) {
        toast.success("Subscription canceled");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setCancelingSub(false);
    }
  }

  const outstanding = invoices.filter((i) => i.status === "open" || i.status === "draft");

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Quick charge — primary action */}
      <section className="rounded-3xl border-2 border-brand/30 bg-gradient-to-br from-brand/5 via-white to-white shadow-soft p-6 md:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
            <Zap className="h-4 w-4 text-brand" />
            <span className="uppercase tracking-wider text-xs">
              Charge {restaurantName}
            </span>
          </div>
          {invoices.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync from Stripe
            </Button>
          )}
        </div>

        <p className="text-sm text-surface-700">
          Enter an amount → click <strong>Charge</strong>. Stripe creates a hosted
          payment page; you get the link to share via text, email, or in person.
        </p>

        <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-end">
          <div className="grid gap-1.5">
            <Label>Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                $
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min="1"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="500"
                className="pl-7 text-lg font-medium"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>What for?</Label>
            <Input
              value={chargeDesc}
              onChange={(e) => setChargeDesc(e.target.value)}
              placeholder={`Website services for ${restaurantName}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={chargeEmail}
              onChange={(e) => setChargeEmail(e.target.checked)}
              className="h-4 w-4 rounded border-surface-300 text-brand focus:ring-brand"
            />
            Also email via Stripe ({form.clientBillingEmail || restaurantEmail || "no email on file"})
          </label>
          <Button
            type="button"
            onClick={onCharge}
            disabled={charging || !hasOperatorStripe}
            size="lg"
          >
            {charging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Charge {chargeAmount ? `$${chargeAmount}` : ""}
              </>
            )}
          </Button>
        </div>

        {!hasOperatorStripe && (
          <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700" />
            <div className="flex-1">
              Connect your Stripe in{" "}
              <a href="/app/settings" className="font-medium underline">
                Settings
              </a>{" "}
              to send invoices. We use YOUR Stripe account — payments land directly
              with you.
            </div>
          </div>
        )}
      </section>

      {/* Outstanding callout */}
      {outstanding.length > 0 && (
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-center gap-3 flex-wrap">
          <Clock className="h-4 w-4 text-amber-700 shrink-0" />
          <div className="flex-1">
            <strong>{outstanding.length}</strong> invoice
            {outstanding.length === 1 ? "" : "s"} awaiting payment —{" "}
            {formatMoney(outstanding.reduce((s, i) => s + i.amountCents, 0))} outstanding.
          </div>
        </div>
      )}

      {/* Subscription card */}
      {(form.mode === "monthly" || hasActiveSub || initial?.pendingCheckoutUrl) && (
        <SubscriptionCard
          monthlyAmount={form.amountDollars}
          hasActiveSub={hasActiveSub}
          pendingCheckoutUrl={initial?.pendingCheckoutUrl ?? null}
          status={initial?.status ?? "draft"}
          starting={startingSub}
          canceling={cancelingSub}
          hasOperatorStripe={hasOperatorStripe}
          onStart={onStartSubscription}
          onCancel={onCancelSubscription}
          onReuseLink={(url) =>
            setShareLink({
              url,
              amountCents: parseFloat(form.amountDollars || "0") * 100,
              description: form.description.trim() || `Monthly subscription — ${restaurantName}`,
              emailed: false,
              kind: "subscription",
            })
          }
        />
      )}

      {/* Invoice history */}
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft overflow-hidden">
        <header className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
          <h2 className="font-display text-xl text-surface-900">Invoice history</h2>
          <div className="text-xs text-surface-500">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
          </div>
        </header>
        {invoices.length === 0 ? (
          <div className="p-10 text-center text-sm text-surface-500">
            No invoices yet. Send your first one above.
          </div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {invoices.map((inv) => (
              <InvoiceRowItem key={inv.id} invoice={inv} />
            ))}
          </ul>
        )}
      </section>

      {/* Advanced config — mode picker + per-client billing details */}
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full px-6 md:px-8 py-5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
            <CreditCard className="h-4 w-4 text-surface-400" />
            <span className="uppercase tracking-wider text-xs">
              How you charge {restaurantName}
            </span>
          </div>
          <span className="text-xs text-surface-500">
            {showAdvanced ? "Hide" : "Configure"}
          </span>
        </button>
        {showAdvanced && (
          <div className="px-6 md:px-8 pb-8 space-y-5 border-t border-surface-100 pt-6">
            <div className="grid sm:grid-cols-3 gap-3">
              {BILLING_MODES.map((m) => {
                const meta = BILLING_MODE_META[m];
                const active = form.mode === m;
                const Icon =
                  m === "revenue_share" ? Percent : m === "monthly" ? Calendar : CreditCard;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mode: m }))}
                    className={cn(
                      "text-left rounded-2xl border-2 p-4 transition-all",
                      active
                        ? "border-brand bg-brand/5 shadow-soft"
                        : "border-surface-200 bg-white hover:border-surface-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-8 w-8 grid place-items-center rounded-full",
                          active ? "bg-brand text-brand-fg" : "bg-surface-100 text-surface-600"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="font-medium text-surface-900">{meta.label}</div>
                    </div>
                    <p className="mt-2 text-xs text-surface-600 leading-relaxed">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {form.mode === "revenue_share" && (
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="grid gap-1.5">
                  <Label>Your cut (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.percentage}
                      onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))}
                      placeholder="3"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm">
                      %
                    </span>
                  </div>
                  <p className="text-xs text-surface-500">
                    You bill monthly based on the restaurant&apos;s order volume — view
                    it on their admin Dashboard.
                  </p>
                </div>
              </div>
            )}
            {(form.mode === "one_time" || form.mode === "monthly") && (
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="grid gap-1.5">
                  <Label>
                    {form.mode === "one_time" ? "Setup fee" : "Monthly rate"} (USD)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      value={form.amountDollars}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amountDollars: e.target.value }))
                      }
                      placeholder="500"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Description (shown on invoices)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={`Website services for ${restaurantName}`}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label>Client billing email</Label>
                <Input
                  type="email"
                  value={form.clientBillingEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientBillingEmail: e.target.value }))
                  }
                  placeholder={restaurantEmail ?? "owner@business.com"}
                />
                <p className="text-xs text-surface-500">
                  Defaults to the restaurant&apos;s email.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label>Client billing name</Label>
                <Input
                  value={form.clientBillingName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientBillingName: e.target.value }))
                  }
                  placeholder={restaurantName}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save billing config
              </Button>
            </div>
          </div>
        )}
      </section>

      {shareLink && (
        <ShareLinkModal
          url={shareLink.url}
          amountCents={shareLink.amountCents}
          description={shareLink.description}
          restaurantName={restaurantName}
          emailed={shareLink.emailed}
          kind={shareLink.kind}
          email={form.clientBillingEmail || restaurantEmail || ""}
          onClose={() => setShareLink(null)}
        />
      )}
    </div>
  );
}

function SubscriptionCard({
  monthlyAmount,
  hasActiveSub,
  pendingCheckoutUrl,
  status,
  starting,
  canceling,
  hasOperatorStripe,
  onStart,
  onCancel,
  onReuseLink,
}: {
  monthlyAmount: string;
  hasActiveSub: boolean;
  pendingCheckoutUrl: string | null;
  status: string;
  starting: boolean;
  canceling: boolean;
  hasOperatorStripe: boolean;
  onStart: () => void;
  onCancel: () => void;
  onReuseLink: (url: string) => void;
}) {
  const amount = parseFloat(monthlyAmount || "0");
  return (
    <section className="rounded-3xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white shadow-soft p-6 md:p-8 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <Repeat className="h-4 w-4 text-sky-600" />
        <span className="uppercase tracking-wider text-xs">Monthly subscription</span>
      </div>

      {hasActiveSub ? (
        <>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-display text-3xl text-surface-900">
              ${amount.toFixed(2)}
            </span>
            <span className="text-sm text-surface-600">per month · auto-charging</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                status === "active"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : status === "canceled"
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-surface-100 text-surface-700 ring-surface-200"
              )}
            >
              {status}
            </span>
          </div>
          <p className="text-sm text-surface-600">
            Card on file is charged automatically each month. New invoices appear in the
            history below as Stripe processes them.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={canceling}
          >
            {canceling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
            Cancel subscription
          </Button>
        </>
      ) : pendingCheckoutUrl ? (
        <>
          <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-sm text-amber-900">
            <strong>Waiting on client to subscribe.</strong> Share the link again, or
            hit Sync once they&apos;ve entered their card.
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onReuseLink(pendingCheckoutUrl)}
          >
            <Link2 className="h-3.5 w-3.5" /> Re-share checkout link
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-surface-700">
            Start a recurring subscription. Stripe creates a checkout page; you share
            the link with your client, they enter card info once, then it auto-charges
            <strong> ${amount > 0 ? amount.toFixed(2) : "—"}/mo</strong> on Stripe.
          </p>
          <Button
            type="button"
            onClick={onStart}
            disabled={starting || !hasOperatorStripe || amount <= 0}
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating link…
              </>
            ) : (
              <>
                <Repeat className="h-4 w-4" /> Start ${amount > 0 ? amount.toFixed(2) : ""}/mo
                subscription
              </>
            )}
          </Button>
          {amount <= 0 && (
            <p className="text-xs text-surface-500">
              Set a monthly amount in the configuration below first.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ShareLinkModal({
  url,
  amountCents,
  description,
  restaurantName,
  emailed,
  kind,
  email,
  onClose,
}: {
  url: string;
  amountCents: number;
  description: string;
  restaurantName: string;
  emailed: boolean;
  kind: "invoice" | "subscription";
  email: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState<"url" | "sms" | "email" | null>(null);
  const amountStr = formatMoney(amountCents);

  const smsBody =
    kind === "subscription"
      ? `Hey — here's the secure link to start your ${amountStr}/mo subscription for ${restaurantName}: ${url}`
      : `Hey — here's your invoice for ${amountStr} (${description}): ${url}`;
  const emailBody =
    kind === "subscription"
      ? `Hi,\n\nReady to start your monthly subscription for ${restaurantName} (${amountStr}/mo)?\n\nClick here to enter your card and activate — secure via Stripe:\n${url}\n\nLet me know if you have questions.`
      : `Hi,\n\nYour invoice for ${restaurantName} is ready (${amountStr}).\n\nPay securely with one click:\n${url}\n\nLet me know if you have questions.`;

  function copy(text: string, which: "url" | "sms" | "email") {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      toast.success("Copied");
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white shadow-elevated p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-xl text-surface-900">
                {kind === "subscription" ? "Subscription link ready" : "Invoice ready"}
              </div>
              <div className="text-sm text-surface-500">
                {amountStr}
                {kind === "subscription" ? "/mo" : ""} ·{" "}
                {emailed ? `Emailed to ${email || "client"}` : "Not yet emailed"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full text-surface-500 hover:bg-surface-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <Label className="text-xs">Payment link</Label>
          <div className="mt-1 flex gap-2">
            <Input value={url} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copy(url, "url")}
            >
              {copied === "url" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-surface-500">
            Anyone with this link can pay. Stripe handles card entry + receipt.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Suggested text</Label>
            <Textarea
              readOnly
              value={smsBody}
              rows={4}
              className="mt-1 text-xs font-mono leading-relaxed"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => copy(smsBody, "sms")}
            >
              {copied === "sms" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy SMS
            </Button>
          </div>
          <div>
            <Label className="text-xs">Suggested email</Label>
            <Textarea
              readOnly
              value={emailBody}
              rows={4}
              className="mt-1 text-xs font-mono leading-relaxed"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => copy(emailBody, "email")}
            >
              {copied === "email" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy email
            </Button>
          </div>
        </div>

        <div className="flex justify-between gap-3 pt-2 border-t border-surface-100">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            Preview <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function InvoiceRowItem({ invoice }: { invoice: InvoiceRow }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      const res = await refreshInvoiceStatus({ invoiceLocalId: invoice.id });
      if (res.ok) {
        toast.success(`Status: ${res.status}`);
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Refresh failed");
      }
    } finally {
      setRefreshing(false);
    }
  }

  function onCopyLink() {
    if (!invoice.hostedUrl) return;
    void navigator.clipboard.writeText(invoice.hostedUrl).then(() => {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const tone = statusTone(invoice.status);
  const Icon =
    invoice.status === "paid"
      ? CheckCircle2
      : invoice.status === "open"
        ? Clock
        : invoice.status === "void" || invoice.status === "uncollectible"
          ? AlertCircle
          : Clock;

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
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
      >
        {invoice.status}
      </span>
      {invoice.hostedUrl && (
        <>
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 hover:bg-surface-200 px-3 py-1.5 text-xs font-medium text-surface-800 transition"
          >
            {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={invoice.hostedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="h-8 w-8 grid place-items-center rounded-full text-surface-400 hover:text-surface-800 hover:bg-surface-100 transition"
        aria-label="Refresh status"
      >
        {refreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
      </button>
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
