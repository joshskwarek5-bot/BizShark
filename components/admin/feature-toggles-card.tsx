"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  SlidersHorizontal,
  ChefHat,
  ShoppingCart,
  ListChecks,
  MessageSquareQuote,
  CalendarClock,
  Image as ImageIcon,
  Quote,
  Mail,
  Clock,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURE_META,
  FEATURE_KEYS,
  normalizeFeatures,
  type FeatureKey,
} from "@/lib/features";
import { type BusinessType, BUSINESS_TYPE_META } from "@/lib/business-types";
import { Button } from "@/components/ui/button";
import { updateRestaurantFeatures } from "@/app/r/[slug]/admin/(panel)/actions";

const ICONS: Record<FeatureKey, React.ComponentType<{ className?: string }>> = {
  menu: ChefHat,
  online_ordering: ShoppingCart,
  services_list: ListChecks,
  quote_request: MessageSquareQuote,
  appointment_request: CalendarClock,
  gallery: ImageIcon,
  testimonials: Quote,
  contact_form: Mail,
  hours: Clock,
};

interface Props {
  slug: string;
  type: BusinessType;
  initial: FeatureKey[];
}

/**
 * Reusable feature-toggle card. Used:
 *  1) standalone on the restaurant Settings page (saves on click), and
 *  2) embedded in the new-client form (controlled — saves with the rest).
 */
export function FeatureTogglesCard({ slug, type, initial }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState<Set<FeatureKey>>(
    () => new Set(initial)
  );
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const typeMeta = BUSINESS_TYPE_META[type];
  const available = FEATURE_KEYS.filter((k) =>
    FEATURE_META[k].applicableTo.includes(type)
  );

  function toggle(key: FeatureKey) {
    const meta = FEATURE_META[key];
    if (meta.alwaysOn) {
      toast.message(`${meta.label} is always on for ${typeMeta.label}.`);
      return;
    }
    setEnabled((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
        // If toggling off X disables a dependent feature, drop the dependent.
        for (const k of Array.from(next)) {
          if ((FEATURE_META[k].requires ?? []).includes(key)) {
            next.delete(k);
          }
        }
      } else {
        next.add(key);
        // Auto-enable required features.
        for (const dep of meta.requires ?? []) {
          next.add(dep);
        }
      }
      setDirty(true);
      return next;
    });
  }

  async function onSave() {
    if (saving) return;
    setSaving(true);
    try {
      const normalized = normalizeFeatures(type, enabled);
      const res = await updateRestaurantFeatures({ slug, features: normalized });
      if (res.ok) {
        setEnabled(new Set(res.features));
        setDirty(false);
        toast.success("Features updated");
        router.refresh();
      } else {
        toast.error("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <SlidersHorizontal className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">Site features</span>
        </div>
        {dirty && (
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save changes
          </Button>
        )}
      </div>
      <p className="text-sm text-surface-600 mb-5">
        Turn features on or off. Changes go live on the public site immediately
        when you save.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {available.map((key) => {
          const meta = FEATURE_META[key];
          const Icon = ICONS[key];
          const on = enabled.has(key);
          const locked = meta.alwaysOn;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              disabled={locked}
              className={cn(
                "text-left rounded-2xl border-2 p-4 transition-all relative",
                on
                  ? "border-brand bg-brand/5 shadow-soft"
                  : "border-surface-200 bg-white hover:border-surface-300",
                locked && "opacity-80 cursor-default"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-9 w-9 grid place-items-center rounded-full shrink-0",
                    on ? "bg-brand text-brand-fg" : "bg-surface-100 text-surface-600"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-surface-900">{meta.label}</span>
                    {locked && <Lock className="h-3 w-3 text-surface-400" />}
                    {on && !locked && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-1.5 py-0.5">
                        <Check className="h-2.5 w-2.5" /> On
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-surface-600 leading-relaxed">
                    {meta.description}
                  </p>
                  {meta.requires && meta.requires.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-surface-500">
                      Requires:{" "}
                      {meta.requires.map((r) => FEATURE_META[r].label).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
