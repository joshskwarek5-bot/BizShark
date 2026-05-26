"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Palette, Loader2, ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setRestaurantTemplate } from "@/app/r/[slug]/admin/(panel)/actions";
import {
  TemplateThumbnail,
  type TemplateThumbnailId,
} from "@/components/templates/template-thumbnail";

const OPTIONS: Array<{
  id: TemplateThumbnailId;
  label: string;
  description: string;
}> = [
  {
    id: "modern",
    label: "Modern",
    description: "Warm + organic, full-bleed hero photo, soft serif headings.",
  },
  {
    id: "classic",
    label: "Classic",
    description: "Formal + elegant, centered serif typography, restrained palette.",
  },
];

export function TemplatePicker({
  slug,
  current,
  primaryColor,
  accentColor,
}: {
  slug: string;
  current: string;
  primaryColor?: string;
  accentColor?: string;
}) {
  const router = useRouter();
  const [active, setActive] = React.useState(current);
  const [saving, setSaving] = React.useState<string | null>(null);

  async function pick(id: TemplateThumbnailId) {
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
        The look and layout of your public-facing site. Tap a preview, then
        &ldquo;See it live&rdquo; to view it with your real content before you
        commit.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {OPTIONS.map((o) => {
          const isActive = active === o.id;
          const isSaving = saving === o.id;
          return (
            <div
              key={o.id}
              className={cn(
                "rounded-2xl border-2 transition-all overflow-hidden",
                isActive
                  ? "border-brand bg-brand/5 shadow-soft"
                  : "border-surface-200 bg-white hover:border-surface-300"
              )}
            >
              <button
                type="button"
                onClick={() => pick(o.id)}
                disabled={isSaving}
                className="block w-full text-left"
              >
                <div className="relative bg-surface-100">
                  <TemplateThumbnail
                    id={o.id}
                    primary={primaryColor}
                    accent={accentColor}
                    className="w-full h-auto block"
                  />
                  {isActive && (
                    <div className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium bg-brand text-brand-fg rounded-full px-2 py-1">
                      <Check className="h-3 w-3" /> Live
                    </div>
                  )}
                  {isSaving && (
                    <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-brand" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-lg text-surface-900">
                      {o.label}
                    </div>
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition",
                        isActive ? "border-brand bg-brand" : "border-surface-300"
                      )}
                    >
                      {isActive && (
                        <div className="m-1 h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm text-surface-600">{o.description}</p>
                </div>
              </button>
              <div className="px-4 pb-4 -mt-1">
                <a
                  href={`/r/${slug}?previewTemplate=${o.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                >
                  See it live <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
