"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Sparkles,
  Crown,
  X,
  Globe,
  Facebook,
  Instagram,
  Star,
  Check,
  AlertTriangle,
  Wand2,
  ChevronDown,
  ChevronUp,
  Users,
  Quote,
  HelpCircle,
  Image as ImageIcon,
  ChefHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  autoBuildClient,
  type AutoBuildResult,
} from "@/app/app/clients/[slug]/auto-build/actions";

interface Props {
  slug: string;
  restaurantName: string;
}

interface UrlSlot {
  id: string;
  url: string;
  kind: "website" | "facebook" | "instagram" | "yelp" | "other";
}

function detectKind(url: string): UrlSlot["kind"] {
  const u = url.toLowerCase();
  if (/facebook\.com|fb\.com/.test(u)) return "facebook";
  if (/instagram\.com/.test(u)) return "instagram";
  if (/yelp\.com/.test(u)) return "yelp";
  if (/^https?:\/\//.test(u) || /^[a-z0-9-]+\.[a-z]/.test(u)) return "website";
  return "other";
}

const KIND_META: Record<
  UrlSlot["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string }
> = {
  website: {
    label: "Website",
    icon: Globe,
    placeholder: "https://theirsite.com",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    placeholder: "facebook.com/their-page",
  },
  instagram: {
    label: "Instagram",
    icon: Instagram,
    placeholder: "instagram.com/their-handle",
  },
  yelp: { label: "Yelp", icon: Star, placeholder: "yelp.com/biz/their-shop" },
  other: { label: "URL", icon: Globe, placeholder: "https://…" },
};

const STAGES = [
  "Fetching all sources…",
  "Pulling photos + structured data…",
  "Claude is extracting services + menu + staff…",
  "Merging signals from each source…",
  "Populating team + testimonials + FAQ…",
  "Downloading + saving gallery photos…",
  "Almost done — finalizing…",
];

export function AutoBuildCard({ slug, restaurantName }: Props) {
  const router = useRouter();
  const [slots, setSlots] = React.useState<UrlSlot[]>([
    { id: rid(), url: "", kind: "website" },
  ]);
  const [setHeroIfMissing, setSetHeroIfMissing] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [result, setResult] = React.useState<AutoBuildResult | null>(null);
  const [showDetails, setShowDetails] = React.useState(true);

  React.useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      500
    );
    return () => clearInterval(t);
  }, [running]);

  function rid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function addSlot() {
    if (slots.length >= 5) {
      toast.message("Max 5 sources");
      return;
    }
    setSlots((s) => [...s, { id: rid(), url: "", kind: "other" }]);
  }
  function removeSlot(id: string) {
    setSlots((s) => (s.length === 1 ? s : s.filter((x) => x.id !== id)));
  }
  function setUrl(id: string, url: string) {
    setSlots((s) =>
      s.map((x) => (x.id === id ? { ...x, url, kind: detectKind(url) } : x))
    );
  }

  function stageMsg(s: number): string {
    if (s < 5) return STAGES[0];
    if (s < 10) return STAGES[1];
    if (s < 25) return STAGES[2];
    if (s < 35) return STAGES[3];
    if (s < 50) return STAGES[4];
    if (s < 80) return STAGES[5];
    return STAGES[6];
  }

  async function onRun() {
    if (running) return;
    const urls = slots.map((s) => s.url.trim()).filter((u) => u.length >= 4);
    if (urls.length === 0) {
      toast.error("Paste at least one URL");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await autoBuildClient({
        slug,
        urls,
        setHeroIfMissing,
      });
      setResult(res);
      if (res.ok) {
        const s = res.summary;
        const bits: string[] = [];
        if (s.staffCreated > 0) bits.push(`${s.staffCreated} team`);
        if (s.testimonialsCreated > 0) bits.push(`${s.testimonialsCreated} testimonials`);
        if (s.faqsCreated > 0) bits.push(`${s.faqsCreated} FAQs`);
        if (s.galleryCreated > 0) bits.push(`${s.galleryCreated} photos`);
        if (s.menuItemsCreated > 0) bits.push(`${s.menuItemsCreated} menu items`);
        if (s.servicesSet > 0) bits.push(`${s.servicesSet} services`);
        if (s.fieldsUpdated.length > 0) bits.push(`${s.fieldsUpdated.length} text fields`);
        if (s.menuPhotosGenerated > 0)
          bits.push(`${s.menuPhotosGenerated} AI menu photos`);
        if (s.heroSet) bits.push(s.heroGenerated ? "AI hero" : "hero image");
        toast.success(
          bits.length > 0
            ? `Auto-built: ${bits.join(" · ")}`
            : "Done — nothing new to add (already had it all)"
        );
        router.refresh();
      } else {
        const isUpgrade = /Pro feature|Upgrade in Billing/i.test(res.error);
        toast.error(res.error, {
          duration: 7000,
          action: isUpgrade
            ? { label: "Upgrade", onClick: () => (window.location.href = "/app/billing") }
            : undefined,
        });
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-3xl border-2 border-brand/30 bg-gradient-to-br from-brand/5 via-white to-white shadow-soft p-6 md:p-8 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-surface-500 mb-1.5">
            <Sparkles className="h-4 w-4 text-brand" />
            <span className="uppercase tracking-wider text-xs">
              Auto-build everything from the web
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand text-brand-fg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              <Crown className="h-2.5 w-2.5" /> Pro
            </span>
          </div>
          <h2 className="font-display text-2xl text-surface-900">
            Drop 1–5 URLs. We&apos;ll fill {restaurantName}.
          </h2>
        </div>
      </div>

      <p className="text-sm text-surface-700">
        Paste their existing site, Facebook page, Yelp listing, Instagram — any
        public sources. We scrape them all in parallel and auto-populate team
        members, services, menu items, FAQs, testimonials, gallery photos, and
        hero image. Won&apos;t overwrite anything you&apos;ve already set.
      </p>

      {/* URL slots */}
      <div className="space-y-2">
        {slots.map((slot, i) => {
          const meta = KIND_META[slot.kind];
          const Icon = meta.icon;
          return (
            <div key={slot.id} className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-white ring-1 ring-surface-200 text-xs font-medium text-surface-700 shrink-0">
                <Icon className="h-3.5 w-3.5 text-brand" />
                {meta.label}
              </div>
              <Input
                value={slot.url}
                onChange={(e) => setUrl(slot.id, e.target.value)}
                placeholder={meta.placeholder}
                disabled={running}
                className="font-mono text-xs sm:text-sm"
              />
              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlot(slot.id)}
                  disabled={running}
                  className="h-9 w-9 grid place-items-center rounded-full text-surface-400 hover:bg-red-50 hover:text-red-600 transition shrink-0 disabled:opacity-50"
                  aria-label="Remove URL"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {i === slots.length - 1 && slots.length < 5 && (
                <button
                  type="button"
                  onClick={addSlot}
                  disabled={running}
                  className="h-9 w-9 grid place-items-center rounded-full text-brand hover:bg-brand/10 transition shrink-0 disabled:opacity-50"
                  aria-label="Add another URL"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
        <div className="text-[11px] text-surface-500">
          {slots.length}/5 sources · We&apos;ll dedupe staff + services + testimonials across them.
        </div>
      </div>

      {/* Options */}
      <label className="flex items-start gap-2 text-sm text-surface-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={setHeroIfMissing}
          onChange={(e) => setSetHeroIfMissing(e.target.checked)}
          disabled={running}
          className="mt-0.5 h-4 w-4 rounded border-surface-300 text-brand focus:ring-brand"
        />
        <span>
          <strong>Auto-pick a hero image</strong> from the scraped photos (only
          if no hero is set).
        </span>
      </label>

      {/* Action */}
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={onRun}
          disabled={running || slots.every((s) => !s.url.trim())}
          size="lg"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Building…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" /> Auto-build
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {running && (
        <div className="rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sky-900">{stageMsg(elapsed)}</div>
            <div className="text-xs text-sky-700 mt-0.5 tabular-nums">
              {elapsed}s elapsed · multi-source builds take 30–120s
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && result.ok && (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <Check className="h-4 w-4 text-emerald-700" />
              Auto-build complete — {result.successfulScrapes}/{result.totalUrls} sources scraped
            </div>
            <button
              type="button"
              onClick={() => setShowDetails((s) => !s)}
              className="text-xs text-emerald-700 inline-flex items-center gap-1 hover:underline"
            >
              {showDetails ? "Hide" : "Show"} breakdown{" "}
              {showDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>

          {showDetails && (
            <>
              <SummaryGrid summary={result.summary} />

              {result.perSource.some((s) => !s.ok) && (
                <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900">
                  <div className="font-medium mb-1 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Some sources failed
                  </div>
                  <ul className="space-y-0.5">
                    {result.perSource
                      .filter((s) => !s.ok)
                      .map((s, i) => (
                        <li key={i}>
                          <span className="font-mono">{shortenUrl(s.url)}</span>{" "}
                          — {s.error}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] text-emerald-700">
                Reload your client overview or open Team / Gallery / Menu to
                see what got created.
              </div>
            </>
          )}
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 text-sm text-red-900">
          <div className="font-medium mb-1 inline-flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Auto-build failed
          </div>
          <div className="text-xs">{result.error}</div>
        </div>
      )}
    </section>
  );
}

function SummaryGrid({ summary }: { summary: NonNullable<AutoBuildResult & { ok: true }>["summary"] }) {
  const cards = [
    {
      icon: Users,
      label: "Team",
      count: summary.staffCreated,
      skipped: summary.staffSkipped,
    },
    {
      icon: Quote,
      label: "Testimonials",
      count: summary.testimonialsCreated,
      skipped: summary.testimonialsSkipped,
    },
    {
      icon: HelpCircle,
      label: "FAQs",
      count: summary.faqsCreated,
      skipped: summary.faqsSkipped,
    },
    {
      icon: ImageIcon,
      label: "Gallery photos",
      count: summary.galleryCreated,
      skipped: summary.galleryFailed,
      skippedLabel: "failed",
    },
    {
      icon: ChefHat,
      label: "Menu items",
      count: summary.menuItemsCreated,
      skipped: 0,
    },
    {
      icon: Sparkles,
      label: "Services",
      count: summary.servicesSet,
      skipped: 0,
    },
    {
      icon: Wand2,
      label: "AI menu photos",
      count: summary.menuPhotosGenerated,
      skipped: 0,
    },
    {
      icon: ImageIcon,
      label: "Hero generated",
      count: summary.heroGenerated ? 1 : 0,
      skipped: 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={cn(
              "rounded-xl bg-white ring-1 p-3",
              c.count > 0
                ? "ring-emerald-200"
                : "ring-surface-200 opacity-60"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  c.count > 0 ? "text-emerald-700" : "text-surface-400"
                )}
              />
              <div className="text-[10px] uppercase tracking-wider font-medium text-surface-500">
                {c.label}
              </div>
            </div>
            <div className="font-display text-2xl tabular-nums text-surface-900">
              +{c.count}
            </div>
            {c.skipped > 0 && (
              <div className="text-[10px] text-surface-500 mt-0.5">
                {c.skipped} {c.skippedLabel ?? "skipped"} (dupes)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function shortenUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.slice(0, 30);
  }
}

// Keep lucide imports used by stage labels even if some aren't in the final paint
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ = [Star];
