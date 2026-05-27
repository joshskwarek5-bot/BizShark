"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  X,
  Sparkles,
  ShieldCheck,
  Send,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  refreshRestaurantStripe,
  setOperatorPlatformFee,
  setupRestaurantStripe,
} from "@/app/app/clients/[slug]/payments/actions";

interface Props {
  slug: string;
  restaurantName: string;
  restaurantEmail: string | null;
  initial: {
    stripeAccountId: string | null;
    stripeAccountStatus: string;
    stripeChargesEnabled: boolean;
    stripePayoutsEnabled: boolean;
    platformFeeBps: number;
  };
}

interface StatusMeta {
  label: string;
  tone: "neutral" | "amber" | "emerald" | "red";
  blurb: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  none: {
    label: "Not set up",
    tone: "neutral",
    blurb:
      "This restaurant can't accept online card payments until you connect Stripe for them.",
  },
  pending: {
    label: "Onboarding pending",
    tone: "amber",
    blurb:
      "Stripe account created — owner needs to finish the few-question onboarding (bank, ID). Re-share the link or finish it on their behalf.",
  },
  active: {
    label: "Accepting payments",
    tone: "emerald",
    blurb:
      "Card payments are live. Orders show up in the kitchen the moment they're paid.",
  },
  restricted: {
    label: "Action required",
    tone: "red",
    blurb:
      "Stripe paused this account — usually missing tax ID, bank info, or something flagged in review. Open the dashboard to fix.",
  },
};

export function RestaurantStripeCard({
  slug,
  restaurantName,
  restaurantEmail,
  initial,
}: Props) {
  const router = useRouter();
  const [setting, setSetting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [share, setShare] = React.useState<{ url: string; isNew: boolean } | null>(
    null
  );
  const [feeEdit, setFeeEdit] = React.useState(false);
  const [feePct, setFeePct] = React.useState((initial.platformFeeBps / 100).toString());
  const [savingFee, setSavingFee] = React.useState(false);

  const status = initial.stripeAccountStatus;
  const meta = STATUS_META[status] ?? STATUS_META.none;

  async function onSetup() {
    if (setting) return;
    setSetting(true);
    try {
      const res = await setupRestaurantStripe({ slug });
      if (res.ok) {
        setShare({ url: res.url, isNew: res.isNew });
        toast.success(
          res.isNew
            ? "Stripe account created — share the link with the owner"
            : "Fresh onboarding link ready"
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setSetting(false);
    }
  }

  async function onRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await refreshRestaurantStripe({ slug });
      if (res.ok) {
        if (res.status !== status) {
          toast.success(
            `Status updated: ${res.status}${res.chargesEnabled ? " · accepting cards" : ""}`
          );
        } else {
          toast.message(`Still ${res.status}`);
        }
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function onSaveFee() {
    if (savingFee) return;
    const pct = parseFloat(feePct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 25) {
      toast.error("Fee must be 0–25%");
      return;
    }
    setSavingFee(true);
    try {
      const bps = Math.round(pct * 100);
      const res = await setOperatorPlatformFee({ slug, bps });
      if (res.ok) {
        toast.success(`Platform fee set to ${pct}%`);
        setFeeEdit(false);
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Save failed");
      }
    } finally {
      setSavingFee(false);
    }
  }

  return (
    <>
      <section
        className={cn(
          "rounded-3xl border-2 shadow-soft p-6 md:p-8 space-y-5",
          meta.tone === "emerald"
            ? "border-emerald-300 bg-gradient-to-br from-emerald-50/50 via-white to-white"
            : meta.tone === "amber"
              ? "border-amber-300 bg-gradient-to-br from-amber-50/50 via-white to-white"
              : meta.tone === "red"
                ? "border-red-300 bg-gradient-to-br from-red-50/50 via-white to-white"
                : "border-brand/30 bg-gradient-to-br from-brand/5 via-white to-white"
        )}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
            <CreditCard className="h-4 w-4 text-brand" />
            <span className="uppercase tracking-wider text-xs">
              Take payments — Stripe Connect
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              meta.tone === "emerald"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : meta.tone === "amber"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : meta.tone === "red"
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-surface-100 text-surface-700 ring-surface-200"
            )}
          >
            {meta.tone === "emerald" && <ShieldCheck className="h-3 w-3" />}
            {meta.label}
          </span>
        </div>

        <div>
          <div className="font-display text-xl text-surface-900">
            {status === "active"
              ? `${restaurantName} can take online orders right now`
              : status === "pending"
                ? `${restaurantName} is mid-setup — share the link`
                : status === "restricted"
                  ? `${restaurantName} needs Stripe attention`
                  : `Set up payments for ${restaurantName}`}
          </div>
          <p className="mt-2 text-sm text-surface-600 leading-relaxed">{meta.blurb}</p>
        </div>

        {/* Capabilities row (shown when account exists) */}
        {initial.stripeAccountId && (
          <div className="grid grid-cols-2 gap-2">
            <CapabilityChip label="Cards" on={initial.stripeChargesEnabled} />
            <CapabilityChip label="Payouts" on={initial.stripePayoutsEnabled} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-surface-100">
          {status === "none" ? (
            <Button onClick={onSetup} disabled={setting} size="lg">
              {setting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating Stripe account…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Set up payments for them
                </>
              )}
            </Button>
          ) : (
            <Button onClick={onSetup} disabled={setting}>
              {setting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {status === "active" ? "Re-share dashboard link" : "Re-share onboarding link"}
            </Button>
          )}
          {initial.stripeAccountId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync status
            </Button>
          )}
          <button
            type="button"
            onClick={() => setFeeEdit((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-brand transition"
          >
            <Percent className="h-3 w-3" /> Your cut: {(initial.platformFeeBps / 100).toFixed(1)}%
          </button>
        </div>

        {/* Platform fee inline editor */}
        {feeEdit && (
          <div className="rounded-2xl bg-surface-50 ring-1 ring-surface-200 p-4 space-y-3">
            <div className="text-xs font-medium text-surface-700">
              How much of each order do YOU take?
            </div>
            <div className="flex items-center gap-2">
              <div className="relative max-w-[140px]">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  max="25"
                  value={feePct}
                  onChange={(e) => setFeePct(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm">
                  %
                </span>
              </div>
              <Button size="sm" onClick={onSaveFee} disabled={savingFee}>
                {savingFee ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFeeEdit(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-[11px] text-surface-500">
              Stripe transfers (100 − fee)% to the restaurant; you keep the rest.
              Most agencies charge 3–10%.
            </p>
          </div>
        )}
      </section>

      {share && (
        <ShareLinkModal
          url={share.url}
          isNew={share.isNew}
          restaurantName={restaurantName}
          email={restaurantEmail}
          onClose={() => setShare(null)}
        />
      )}
    </>
  );
}

function CapabilityChip({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 flex items-center justify-between text-xs",
        on
          ? "bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800"
          : "bg-surface-100 ring-1 ring-surface-200 text-surface-600"
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="inline-flex items-center gap-1">
        {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {on ? "Enabled" : "Pending"}
      </span>
    </div>
  );
}

function ShareLinkModal({
  url,
  isNew,
  restaurantName,
  email,
  onClose,
}: {
  url: string;
  isNew: boolean;
  restaurantName: string;
  email: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState<"url" | "sms" | "email" | null>(null);
  const smsBody = `Hey! ${restaurantName} can now take online orders. Finish the quick Stripe setup so money lands in your bank: ${url}`;
  const emailBody = `Hi,\n\n${restaurantName} is ready to go live with online ordering. You just need to finish the quick Stripe setup (5 minutes — bank info, basic ID) so customer payments deposit straight to your bank:\n\n${url}\n\nLink expires in a few minutes — refresh it if needed.\n\nTalk soon.`;

  function copy(text: string, which: "url" | "sms" | "email") {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      toast.success("Copied");
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white shadow-elevated p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-xl text-surface-900">
                {isNew ? "Stripe account created" : "Onboarding link ready"}
              </div>
              <div className="text-sm text-surface-500">
                Share with the owner to finish setup (5 min).
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

        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-700" />
          <div>
            Onboarding links expire in a few minutes. If they don&apos;t click
            immediately, just hit &ldquo;Re-share&rdquo; to generate a fresh one.
          </div>
        </div>

        <div>
          <Label className="text-xs">Onboarding link</Label>
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
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            Open it yourself (do it on their behalf) <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Text to send</Label>
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
            <Label className="text-xs">
              Email to {email || "the owner"}
            </Label>
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

        <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
