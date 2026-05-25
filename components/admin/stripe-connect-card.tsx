"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  disconnectStripe,
  getStripeDashboardLink,
  refreshStripeStatus,
  setPlatformFee,
  startStripeOnboarding,
} from "@/app/r/[slug]/admin/(panel)/stripe-actions";

interface Props {
  slug: string;
  stripeConfigured: boolean;
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId: string | null;
  platformFeeBps: number;
  isSuper: boolean;
}

export function StripeConnectCard({
  slug,
  stripeConfigured,
  status,
  chargesEnabled,
  payoutsEnabled,
  accountId,
  platformFeeBps,
  isSuper,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connecting, setConnecting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [dashboardOpening, setDashboardOpening] = React.useState(false);
  const [feeBps, setFeeBps] = React.useState(platformFeeBps);
  const [savingFee, setSavingFee] = React.useState(false);

  // Show toast when user returns from Stripe onboarding
  React.useEffect(() => {
    const sp = searchParams.get("stripe");
    if (!sp) return;
    if (sp === "connected") {
      toast.success("Stripe connection updated", {
        description:
          chargesEnabled === false
            ? "Stripe needs more info before payments can run. Click Continue setup."
            : "You can now accept card payments online.",
      });
    } else if (sp === "error") {
      toast.error("Stripe link expired — try again");
    }
    // Strip the query param so this doesn't re-fire
    const url = new URL(window.location.href);
    url.searchParams.delete("stripe");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams, chargesEnabled]);

  async function onConnect() {
    setConnecting(true);
    try {
      const res = await startStripeOnboarding(slug);
      if (res.ok) {
        window.location.href = res.url;
      } else {
        toast.error(res.error);
        setConnecting(false);
      }
    } catch {
      toast.error("Could not start Stripe onboarding");
      setConnecting(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      const res = await refreshStripeStatus(slug);
      if (res.ok) {
        toast.success("Stripe status refreshed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function onOpenDashboard() {
    setDashboardOpening(true);
    try {
      const res = await getStripeDashboardLink(slug);
      if (res.ok) window.open(res.url, "_blank");
      else toast.error(res.error);
    } finally {
      setDashboardOpening(false);
    }
  }

  async function onDisconnect() {
    if (
      !confirm(
        "Disconnect Stripe? You won't be able to take card payments until you reconnect. (Your Stripe account itself is not deleted.)"
      )
    )
      return;
    setDisconnecting(true);
    try {
      const res = await disconnectStripe(slug);
      if (res.ok) {
        toast.success("Stripe disconnected");
        router.refresh();
      }
    } finally {
      setDisconnecting(false);
    }
  }

  async function onSaveFee() {
    if (feeBps === platformFeeBps) return;
    setSavingFee(true);
    try {
      const res = await setPlatformFee({ slug, bps: feeBps });
      if (res.ok) {
        toast.success("Platform fee saved");
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not save");
      }
    } finally {
      setSavingFee(false);
    }
  }

  // ----- Render variants -----

  if (!stripeConfigured) {
    return (
      <Section>
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <div className="font-medium">Stripe not configured on this deployment</div>
            <p className="mt-1 text-amber-800">
              Add{" "}
              <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                STRIPE_SECRET_KEY
              </code>{" "}
              and{" "}
              <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
              </code>{" "}
              to your <code className="font-mono text-xs">.env</code>, then restart the
              server. Get test keys at{" "}
              <a
                href="https://dashboard.stripe.com/test/apikeys"
                target="_blank"
                rel="noreferrer"
                className="underline font-medium"
              >
                dashboard.stripe.com/test/apikeys
              </a>
              .
            </p>
          </div>
        </div>
      </Section>
    );
  }

  if (!accountId) {
    return (
      <Section>
        <div className="rounded-2xl bg-surface-50 border border-surface-200 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-full bg-brand/10 text-brand shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-surface-900">Take card payments online</div>
              <p className="text-sm text-surface-600 mt-1">
                Connect Stripe to accept Visa, Mastercard, Amex, Apple Pay, Google Pay, and
                Link directly on your checkout page. Money lands in your bank in ~2 business
                days. Onboarding takes about 5–15 minutes.
              </p>
            </div>
          </div>
          <Button onClick={onConnect} disabled={connecting} size="lg">
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Opening Stripe…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" /> Connect Stripe
              </>
            )}
          </Button>
        </div>
        {isSuper && <PlatformFeeRow feeBps={feeBps} setFeeBps={setFeeBps} onSave={onSaveFee} saving={savingFee} dirty={feeBps !== platformFeeBps} />}
      </Section>
    );
  }

  return (
    <Section>
      <div className="grid sm:grid-cols-3 gap-3">
        <StatusTile
          label="Account"
          value={statusLabel(status)}
          tone={status === "active" ? "success" : status === "pending" ? "warning" : "danger"}
        />
        <StatusTile
          label="Card payments"
          value={chargesEnabled ? "Enabled" : "Disabled"}
          tone={chargesEnabled ? "success" : "warning"}
        />
        <StatusTile
          label="Payouts to bank"
          value={payoutsEnabled ? "Enabled" : "Disabled"}
          tone={payoutsEnabled ? "success" : "warning"}
        />
      </div>

      {!chargesEnabled && (
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div className="flex-1">
            <div className="font-medium">Stripe still needs information</div>
            <p className="mt-1 text-amber-800">
              {status === "pending"
                ? "Finish onboarding to enable card payments."
                : "Stripe paused this account pending more info. Open Stripe to resolve."}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onConnect}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening
              </>
            ) : (
              <>Continue setup</>
            )}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onOpenDashboard} disabled={dashboardOpening}>
          {dashboardOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Open Stripe dashboard
        </Button>
        <Button type="button" variant="ghost" onClick={onRefresh} disabled={refreshing}>
          {refreshing && <Loader2 className="h-4 w-4 animate-spin" />}
          Refresh status
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="text-red-700 hover:bg-red-50"
        >
          {disconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
          Disconnect
        </Button>
      </div>

      <div className="text-xs text-surface-500 font-mono">{accountId}</div>

      {isSuper && (
        <PlatformFeeRow
          feeBps={feeBps}
          setFeeBps={setFeeBps}
          onSave={onSaveFee}
          saving={savingFee}
          dirty={feeBps !== platformFeeBps}
        />
      )}
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <CreditCard className="h-4 w-4 text-brand" />
        <span className="uppercase tracking-wider text-xs">Payments</span>
      </div>
      {children}
    </section>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger";
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : XCircle;
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
      <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`mt-2 flex items-center gap-2 text-sm font-medium ${
          tone === "success"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : "text-red-700"
        }`}
      >
        <Icon className="h-4 w-4" /> {value}
      </div>
    </div>
  );
}

function PlatformFeeRow({
  feeBps,
  setFeeBps,
  onSave,
  saving,
  dirty,
}: {
  feeBps: number;
  setFeeBps: (n: number) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-surface-500">
        <Percent className="h-3.5 w-3.5" /> Platform fee (super-admin only)
      </div>
      <p className="text-sm text-surface-600">
        Percentage of each card order that flows to your platform account. The rest goes
        directly to the restaurant. Set to 0 to disable.
      </p>
      <div className="flex items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="fee-bps">Rate (%)</Label>
          <div className="relative">
            <Input
              id="fee-bps"
              inputMode="decimal"
              value={(feeBps / 100).toFixed(2)}
              onChange={(e) => {
                const n = Math.round(parseFloat(e.target.value || "0") * 100);
                if (!Number.isNaN(n)) setFeeBps(Math.max(0, Math.min(2500, n)));
              }}
              className="w-32 pr-8 font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm">
              %
            </span>
          </div>
        </div>
        <Button onClick={onSave} disabled={saving || !dirty} size="md">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save fee
        </Button>
      </div>
    </div>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "active":
      return "Connected";
    case "pending":
      return "Awaiting setup";
    case "restricted":
      return "Action needed";
    case "none":
    default:
      return "Not connected";
  }
}
