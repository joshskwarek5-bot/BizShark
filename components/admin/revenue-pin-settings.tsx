"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setRevenuePin } from "@/app/r/[slug]/admin/(panel)/actions";

interface Props {
  slug: string;
  hasPin: boolean;
}

export function RevenuePinSettings({ slug, hasPin }: Props) {
  const router = useRouter();
  const [pin, setPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function onSetPin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN must be 4 digits");
      return;
    }
    setSaving(true);
    try {
      const res = await setRevenuePin({ slug, pin });
      if (res.ok) {
        toast.success(hasPin ? "PIN updated" : "PIN set");
        setPin("");
        try {
          window.sessionStorage.removeItem(revealKey(slug));
        } catch {}
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not set PIN");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRemovePin() {
    if (!confirm("Remove the revenue PIN? Revenue will be visible to anyone in the admin.")) return;
    setSaving(true);
    try {
      const res = await setRevenuePin({ slug, pin: null });
      if (res.ok) {
        toast.success("PIN removed");
        try {
          window.sessionStorage.removeItem(revealKey(slug));
        } catch {}
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <Lock className="h-4 w-4 text-brand" />
        <span className="uppercase tracking-wider text-xs">Revenue privacy</span>
      </div>
      <div className="rounded-2xl bg-surface-50 p-4 text-sm text-surface-700">
        <div className="flex items-start gap-3">
          <Eye className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
          <p>
            Set a 4-digit PIN to keep revenue numbers hidden on the dashboard.
            {hasPin
              ? " The revenue tile will be blurred until someone enters the PIN."
              : " Without a PIN, revenue is always visible to anyone signed in."}
          </p>
        </div>
      </div>

      <form onSubmit={onSetPin} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="rev-pin">{hasPin ? "Change PIN" : "Set PIN"}</Label>
          <Input
            id="rev-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="• • • •"
            autoComplete="off"
            className="font-mono tracking-[0.5em] text-center text-lg max-w-40"
          />
        </div>
        <div className="flex gap-2">
          {hasPin && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onRemovePin}
              disabled={saving}
            >
              Remove
            </Button>
          )}
          <Button type="submit" disabled={saving || pin.length !== 4}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasPin ? "Update PIN" : "Set PIN"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function revealKey(slug: string) {
  return `rp_rev_${slug}`;
}
