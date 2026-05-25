"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Palette, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setRestaurantTemplate } from "@/app/r/[slug]/admin/(panel)/actions";

const OPTIONS = [
  {
    id: "modern" as const,
    label: "Modern",
    description: "Warm + organic, full-bleed hero photo, soft serif headings.",
  },
  {
    id: "classic" as const,
    label: "Classic",
    description: "Formal + elegant, centered serif typography, restrained palette.",
  },
];

export function TemplatePicker({
  slug,
  current,
}: {
  slug: string;
  current: string;
}) {
  const router = useRouter();
  const [active, setActive] = React.useState(current);
  const [saving, setSaving] = React.useState<string | null>(null);

  async function pick(id: "modern" | "classic") {
    if (id === active || saving) return;
    setSaving(id);
    try {
      const res = await setRestaurantTemplate({ slug, templateId: id });
      if (res.ok) {
        setActive(id);
        toast.success(`Switched to ${OPTIONS.find((o) => o.id === id)?.label} template`, {
          description: "Public site updated. Refresh to see it.",
        });
        router.refresh();
      } else {
        toast.error("Could not switch template");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <Palette className="h-4 w-4 text-brand" />
        <span className="uppercase tracking-wider text-xs">Website template</span>
      </div>
      <p className="text-sm text-surface-600">
        The look and layout of your public-facing site. Swap any time.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {OPTIONS.map((o) => {
          const isActive = active === o.id;
          const isSaving = saving === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              disabled={isSaving}
              className={cn(
                "text-left rounded-2xl border-2 p-5 transition-all",
                isActive
                  ? "border-brand bg-brand/5 shadow-soft"
                  : "border-surface-200 bg-white hover:border-surface-300"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-lg text-surface-900">{o.label}</div>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                ) : (
                  <div
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition",
                      isActive ? "border-brand bg-brand" : "border-surface-300"
                    )}
                  >
                    {isActive && <div className="m-1 h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-surface-600">{o.description}</p>
              {isActive && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                  Currently live
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
