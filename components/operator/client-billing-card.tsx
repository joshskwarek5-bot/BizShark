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
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BILLING_MODES, BILLING_MODE_META, type BillingMode } from "@/lib/client-billing";
import {
  createOneTimeInvoice,
  refreshInvoiceStatus,
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
  const [sendingInvoice, setSendingInvoice] = React.useState(false);
  const [invoiceAmount, setInvoiceAmount] = React.useState(
    initial?.mode === "one_time" && initial.amountCents
      ? (initial.amountCents / 100).toFixed(2)
      : ""
  );
  const [invoiceDesc, setInvoiceDesc] = React.useState(
    initial?.description ?? `Website services for ${restaurantName}`
  );

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

  async function onSendInvoice() {
    if (sendingInvoice) return;
    const amount = parseFloat(invoiceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setSendingInvoice(true);
    try {
      const res = await createOneTimeInvoice({
        slug,
        amountDollars: amount,
        description: invoiceDesc.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Invoice sent", {
          description: "Stripe emailed your client a hosted invoice with a Pay button.",
        });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setSendingInvoice(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Mode picker */}
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <CreditCard className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">
            How you charge {restaurantName}
          </span>
        </div>

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

        {/* Mode-specific fields */}
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
                You bill monthly based on the restaurant&apos;s order volume — view it on
                their admin Dashboard.
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
              Stripe sends the invoice here. Defaults to the restaurant&apos;s email.
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
      </section>

      {/* Stripe key prerequisite */}
      {!hasOperatorStripe && form.mode !== "revenue_share" && (
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div className="flex-1">
            <div className="font-medium">Connect your Stripe to send invoices</div>
            <p className="mt-1">
              Add your Stripe Secret Key in Settings. You can save the billing config
              now, but invoices won&apos;t send until your key is set.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/app/settings">Settings</a>
          </Button>
        </div>
      )}

      {/* Send invoice (one_time mode) */}
      {form.mode === "one_time" && (
        <section className="rounded-3xl border-2 border-brand/30 bg-gradient-to-br from-brand/5 via-white to-white shadow-soft p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
            <Send className="h-4 w-4 text-brand" />
            <span className="uppercase tracking-wider text-xs">Send invoice now</span>
          </div>
          <p className="text-sm text-surface-700">
            Stripe will email <strong>{form.clientBillingEmail || restaurantEmail || "your client"}</strong> a
            hosted invoice. They click Pay → money lands in your Stripe account.
          </p>
          <div className="grid sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
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
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Input
                value={invoiceDesc}
                onChange={(e) => setInvoiceDesc(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={onSendInvoice}
              disabled={sendingInvoice || !hasOperatorStripe}
              size="lg"
            >
              {sendingInvoice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send invoice
                </>
              )}
            </Button>
          </div>
        </section>
      )}

      {/* Monthly subscription note */}
      {form.mode === "monthly" && (
        <div className="rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 text-sm text-sky-900">
          <strong>Monthly subscription support</strong> — coming next session. For now,
          save the config; full Stripe Subscription provisioning lands shortly.
        </div>
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
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceRow }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

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
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
      >
        {invoice.status}
      </span>
      {invoice.hostedUrl && (
        <a
          href={invoice.hostedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          View <ExternalLink className="h-3 w-3" />
        </a>
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
