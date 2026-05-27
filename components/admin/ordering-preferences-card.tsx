"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateOrderingPreferences } from "@/app/r/[slug]/admin/(panel)/actions";

interface OrderingPreferencesCardProps {
  slug: string;
  initial: {
    tipPresets: number[];
    minOrderCents: number | null;
    prepTimeMinutes: number;
    acceptsCash: boolean;
    acceptsCard: boolean;
    statementDescriptor: string | null;
    taxInclusive: boolean;
  };
}

export function OrderingPreferencesCard({ slug, initial }: OrderingPreferencesCardProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [tipText, setTipText] = React.useState(initial.tipPresets.join(", "));
  const [minOrderDollars, setMinOrderDollars] = React.useState(
    initial.minOrderCents != null ? (initial.minOrderCents / 100).toFixed(2) : ""
  );
  const [prepMinutes, setPrepMinutes] = React.useState(String(initial.prepTimeMinutes));
  const [acceptsCash, setAcceptsCash] = React.useState(initial.acceptsCash);
  const [acceptsCard, setAcceptsCard] = React.useState(initial.acceptsCard);
  const [statementDescriptor, setStatementDescriptor] = React.useState(
    initial.statementDescriptor ?? ""
  );
  const [taxInclusive, setTaxInclusive] = React.useState(initial.taxInclusive);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const tipPresets = tipText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Math.round(parseFloat(s)))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    if (tipPresets.length > 6) {
      toast.error("Up to 6 tip presets allowed");
      return;
    }

    const prep = parseInt(prepMinutes, 10);
    if (!Number.isFinite(prep) || prep < 0 || prep > 120) {
      toast.error("Prep time must be between 0 and 120 minutes");
      return;
    }

    let minCents: number | null = null;
    if (minOrderDollars.trim() !== "") {
      const dollars = parseFloat(minOrderDollars);
      if (!Number.isFinite(dollars) || dollars < 0 || dollars > 1000) {
        toast.error("Minimum order must be between $0 and $1000");
        return;
      }
      minCents = Math.round(dollars * 100);
    }

    if (!acceptsCash && !acceptsCard) {
      toast.error("Enable at least one payment method");
      return;
    }

    if (statementDescriptor.length > 22) {
      toast.error("Statement descriptor must be 22 characters or less");
      return;
    }

    setSaving(true);
    try {
      const res = await updateOrderingPreferences({
        slug,
        tipPresets,
        minOrderCents: minCents,
        prepTimeMinutes: prep,
        acceptsCash,
        acceptsCard,
        statementDescriptor: statementDescriptor.trim() || null,
        taxInclusive,
      });
      if (res.ok) {
        toast.success("Ordering preferences saved");
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not save");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-6"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <Settings2 className="h-4 w-4 text-brand" />
        <span className="uppercase tracking-wider text-xs">Ordering preferences</span>
      </div>

      {/* Tip presets */}
      <div className="grid gap-1.5">
        <Label>Tip presets (%)</Label>
        <Input
          value={tipText}
          onChange={(e) => setTipText(e.target.value)}
          placeholder="15, 18, 20, 25"
          className="max-w-md"
        />
        <p className="text-xs text-surface-500">
          Comma-separated percentages shown to customers at checkout. Leave blank to hide the tip picker.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="grid gap-1.5">
          <Label>Minimum order ($)</Label>
          <Input
            inputMode="decimal"
            value={minOrderDollars}
            onChange={(e) => setMinOrderDollars(e.target.value)}
            placeholder="No minimum"
            className="max-w-40"
          />
          <p className="text-xs text-surface-500">
            Reject orders smaller than this. Leave blank for no minimum.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label>Default prep time (min)</Label>
          <Input
            inputMode="numeric"
            value={prepMinutes}
            onChange={(e) => setPrepMinutes(e.target.value)}
            placeholder="15"
            className="max-w-40"
          />
          <p className="text-xs text-surface-500">
            Shown on the order confirmation as &ldquo;Ready in ~X min&rdquo;.
          </p>
        </div>
      </div>

      {/* Payment methods */}
      <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4 space-y-3">
        <div className="font-medium text-surface-900 text-sm">Payment methods</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-surface-800">Pay at pickup (cash)</div>
            <p className="text-xs text-surface-500 mt-0.5">
              Customer pays in person when they arrive.
            </p>
          </div>
          <Switch
            checked={acceptsCash}
            onCheckedChange={setAcceptsCash}
            aria-label="Accept pay at pickup"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-surface-800">Card at checkout</div>
            <p className="text-xs text-surface-500 mt-0.5">
              Requires Stripe Connect. Customer pays online.
            </p>
          </div>
          <Switch
            checked={acceptsCard}
            onCheckedChange={setAcceptsCard}
            aria-label="Accept card"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Statement descriptor</Label>
        <Input
          value={statementDescriptor}
          maxLength={22}
          onChange={(e) => setStatementDescriptor(e.target.value)}
          placeholder={`Defaults to "${"restaurant name".slice(0, 22)}"`}
          className="max-w-md"
        />
        <p className="text-xs text-surface-500">
          What appears on the customer&apos;s card statement. Max 22 chars; letters, numbers, spaces only. {statementDescriptor.length}/22
        </p>
      </div>

      {/* Tax inclusive */}
      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-surface-50 p-4">
        <div>
          <div className="text-sm font-medium text-surface-800">Tax included in menu prices</div>
          <p className="text-xs text-surface-500 mt-0.5">
            On = prices already include tax (common in EU). Off = tax added at checkout.
          </p>
        </div>
        <Switch
          checked={taxInclusive}
          onCheckedChange={setTaxInclusive}
          aria-label="Tax inclusive"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} size="sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}
