"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Key,
  User as UserIcon,
  Eye,
  EyeOff,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateOperatorProfile,
  updateGooglePlacesKey,
  updateOperatorStripeKey,
} from "@/app/app/settings/actions";

interface SettingsFormProps {
  initial: {
    name: string;
    businessName: string | null;
    areaCity: string | null;
    areaState: string | null;
    hasGooglePlacesKey: boolean;
    hasStripeKey: boolean;
  };
}

export function OperatorSettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);

  const [profile, setProfile] = React.useState({
    name: initial.name ?? "",
    businessName: initial.businessName ?? "",
    areaCity: initial.areaCity ?? "",
    areaState: initial.areaState ?? "",
  });
  const [apiKey, setApiKey] = React.useState("");
  const [keyDirty, setKeyDirty] = React.useState(false);
  const [stripeKey, setStripeKey] = React.useState("");
  const [stripeKeyDirty, setStripeKeyDirty] = React.useState(false);
  const [showStripeKey, setShowStripeKey] = React.useState(false);
  const [savingStripeKey, setSavingStripeKey] = React.useState(false);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const res = await updateOperatorProfile(profile);
      if (res.ok) {
        toast.success("Profile updated");
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not save");
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (savingKey) return;
    setSavingKey(true);
    try {
      const res = await updateGooglePlacesKey({ apiKey });
      if (res.ok) {
        toast.success(res.hasKey ? "API key saved" : "API key cleared");
        setApiKey("");
        setKeyDirty(false);
        router.refresh();
      }
    } finally {
      setSavingKey(false);
    }
  }

  async function onSaveStripeKey(e: React.FormEvent) {
    e.preventDefault();
    if (savingStripeKey) return;
    setSavingStripeKey(true);
    try {
      const res = await updateOperatorStripeKey({ secretKey: stripeKey });
      if (res.ok) {
        toast.success(res.hasKey ? "Stripe key saved" : "Stripe key cleared");
        setStripeKey("");
        setStripeKeyDirty(false);
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not save");
      }
    } finally {
      setSavingStripeKey(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Profile */}
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <UserIcon className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">Profile</span>
        </div>
        <form onSubmit={onSaveProfile} className="grid gap-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Your name" required>
              <Input
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Agency / business name">
              <Input
                value={profile.businessName}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, businessName: e.target.value }))
                }
                placeholder="Acme Web Studio"
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Default search city">
              <Input
                value={profile.areaCity}
                onChange={(e) => setProfile((p) => ({ ...p, areaCity: e.target.value }))}
                placeholder="Denver"
              />
            </Field>
            <Field label="State">
              <Input
                value={profile.areaState}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, areaState: e.target.value }))
                }
                placeholder="CO"
                maxLength={2}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </form>
      </section>

      {/* Google Places API key */}
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <Key className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">Lead engine — Google Places API key</span>
        </div>

        <div className="rounded-2xl bg-surface-50 p-4 text-sm text-surface-700 space-y-2">
          <p>
            The lead finder uses Google Places to search local businesses. You bring
            your own API key — Google bills your account directly (~$0.03 per search).
          </p>
          <p className="text-xs text-surface-500">
            Get a key at{" "}
            <a
              href="https://console.cloud.google.com/google/maps-apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-brand underline hover:no-underline inline-flex items-center gap-0.5"
            >
              console.cloud.google.com/.../credentials
              <ExternalLink className="h-3 w-3" />
            </a>
            . Enable the &quot;Places API (New)&quot; and create an API key with no
            restrictions for testing.
          </p>
        </div>

        {initial.hasGooglePlacesKey && !keyDirty && (
          <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            API key configured. Lead search is enabled.
          </div>
        )}

        <form onSubmit={onSaveKey} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="apiKey">
              {initial.hasGooglePlacesKey ? "Replace key" : "Set key"}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setKeyDirty(true);
                }}
                autoComplete="off"
                placeholder={initial.hasGooglePlacesKey ? "(leave blank to clear)" : "AIza…"}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-surface-500 hover:text-surface-800"
                aria-label={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={savingKey || !keyDirty}>
            {savingKey && <Loader2 className="h-4 w-4 animate-spin" />}
            {apiKey.trim() ? "Save key" : initial.hasGooglePlacesKey ? "Clear key" : "Save"}
          </Button>
        </form>
      </section>

      {/* Operator's own Stripe Secret Key — used to bill THEIR clients */}
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <CreditCard className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">
            Get paid by clients — Stripe Secret Key
          </span>
        </div>

        <div className="rounded-2xl bg-surface-50 p-4 text-sm text-surface-700 space-y-2">
          <p>
            Your Stripe account that <strong>your clients</strong> pay into. When you
            send a client an invoice (one-time or monthly), money lands in this account.
          </p>
          <p className="text-xs text-surface-500">
            Get a key at{" "}
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noreferrer"
              className="text-brand underline hover:no-underline inline-flex items-center gap-0.5"
            >
              dashboard.stripe.com/apikeys
              <ExternalLink className="h-3 w-3" />
            </a>
            . Use the <strong>Secret key</strong> (starts with{" "}
            <code className="font-mono text-xs">sk_test_</code> or{" "}
            <code className="font-mono text-xs">sk_live_</code>). This is separate from
            the platform&apos;s Stripe — it&apos;s YOUR Stripe.
          </p>
        </div>

        {initial.hasStripeKey && !stripeKeyDirty && (
          <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Stripe connected. You can send invoices from any client&apos;s Billing page.
          </div>
        )}

        <form onSubmit={onSaveStripeKey} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="stripeKey">
              {initial.hasStripeKey ? "Replace key" : "Set key"}
            </Label>
            <div className="relative">
              <Input
                id="stripeKey"
                type={showStripeKey ? "text" : "password"}
                value={stripeKey}
                onChange={(e) => {
                  setStripeKey(e.target.value);
                  setStripeKeyDirty(true);
                }}
                autoComplete="off"
                placeholder={initial.hasStripeKey ? "(leave blank to clear)" : "sk_test_…"}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowStripeKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-surface-500 hover:text-surface-800"
                aria-label={showStripeKey ? "Hide" : "Show"}
              >
                {showStripeKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={savingStripeKey || !stripeKeyDirty}>
            {savingStripeKey && <Loader2 className="h-4 w-4 animate-spin" />}
            {stripeKey.trim() ? "Save key" : initial.hasStripeKey ? "Clear key" : "Save"}
          </Button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
