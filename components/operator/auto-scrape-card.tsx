"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Globe,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Crown,
  Star,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { scrapeBusinessSiteAction } from "@/app/app/scrape/actions";
import type { ExtractedSite } from "@/lib/auto-scrape";

export interface ScrapeSelection {
  site: ExtractedSite;
  /** Operator-chosen hero photo URL — null if they unselected all. */
  heroPhotoUrl: string | null;
  /** Operator-chosen gallery photo URLs. */
  galleryPhotoUrls: string[];
}

interface Props {
  initialUrl?: string;
  knownBusinessName?: string;
  knownBusinessType?: string;
  /** Called with the scraped site + photo selections when the operator clicks "Apply to form". */
  onApply: (selection: ScrapeSelection) => void;
}

/**
 * Client-side hero candidate picker (mirrors lib/scraped-photos pickHeroCandidate).
 * Kept in this file so the component doesn't pull in server-only modules.
 */
function pickHeroDefault(urls: string[]): string | null {
  if (urls.length === 0) return null;
  const score = (u: string): number => {
    let s = 0;
    const lower = u.toLowerCase();
    if (/hero|banner|cover|og[-_]?image|main/.test(lower)) s += 100;
    if (/header|landing|home/.test(lower)) s += 30;
    if (/thumb|icon|favicon|logo|avatar|profile/.test(lower)) s -= 80;
    if (/-\d{3,4}x\d{3,4}\./.test(lower)) s += 20;
    if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(lower)) s += 5;
    return s;
  };
  const sorted = [...urls].sort((a, b) => score(b) - score(a));
  return sorted[0] ?? null;
}

const STATUS_MESSAGES = [
  "Fetching the page…",
  "Pulling structured data + photos…",
  "Reading the HTML…",
  "Asking Claude to extract services + menu…",
  "Almost done — long sites take a moment…",
  "Still working — big page, lots of content…",
];

export function AutoScrapeCard({
  initialUrl = "",
  knownBusinessName,
  knownBusinessType,
  onApply,
}: Props) {
  const [url, setUrl] = React.useState(initialUrl);
  const [scraping, setScraping] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [site, setSite] = React.useState<ExtractedSite | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const [heroUrl, setHeroUrl] = React.useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!scraping) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      500
    );
    return () => clearInterval(t);
  }, [scraping]);

  function statusMsg(s: number): string {
    if (s < 3) return STATUS_MESSAGES[0];
    if (s < 6) return STATUS_MESSAGES[1];
    if (s < 12) return STATUS_MESSAGES[2];
    if (s < 25) return STATUS_MESSAGES[3];
    if (s < 40) return STATUS_MESSAGES[4];
    return STATUS_MESSAGES[5];
  }

  async function onScrape() {
    if (scraping) return;
    if (!url.trim() || url.trim().length < 4) {
      toast.error("Enter a website URL");
      return;
    }
    setScraping(true);
    setSite(null);
    try {
      const res = await scrapeBusinessSiteAction({
        url: url.trim(),
        knownBusinessName,
        knownBusinessType,
      });
      if (res.ok) {
        setSite(res.site);
        setShowDetails(true);
        // Pre-select smart defaults
        const defaultHero = pickHeroDefault(res.site.photos);
        setHeroUrl(defaultHero);
        // Default gallery: first 8 non-hero photos
        setGalleryUrls(
          new Set(
            res.site.photos.filter((p) => p !== defaultHero).slice(0, 8)
          )
        );
        const counts: string[] = [];
        if (res.site.services?.length) counts.push(`${res.site.services.length} services`);
        if (res.site.menuCategories?.length) {
          const items = res.site.menuCategories.reduce((s, c) => s + c.items.length, 0);
          counts.push(`${items} menu items`);
        }
        if (res.site.staff?.length) counts.push(`${res.site.staff.length} staff`);
        if (res.site.photos.length) counts.push(`${res.site.photos.length} photos`);
        toast.success("Scraped successfully", {
          description: counts.length > 0 ? counts.join(" · ") : "Click 'Apply' to fill the form",
        });
      } else {
        const isUpgradeError = /Pro feature|Upgrade in Billing/i.test(res.error);
        toast.error(res.error, {
          duration: 6000,
          action: isUpgradeError
            ? { label: "Upgrade", onClick: () => (window.location.href = "/app/billing") }
            : undefined,
        });
      }
    } finally {
      setScraping(false);
    }
  }

  function onApplyClick() {
    if (!site) return;
    onApply({
      site,
      heroPhotoUrl: heroUrl,
      galleryPhotoUrls: Array.from(galleryUrls),
    });
    const photoBits: string[] = [];
    if (heroUrl) photoBits.push("hero");
    if (galleryUrls.size > 0) photoBits.push(`${galleryUrls.size} gallery`);
    const desc = photoBits.length > 0 ? `Photos to import: ${photoBits.join(" + ")}` : null;
    const aiNote = heroUrl
      ? null
      : "No hero selected — AI will generate one on Create (takes ~30s if your OpenAI key is set).";
    toast.success("Applied to form — review and edit before saving", {
      description: [desc, aiNote].filter(Boolean).join(" · ") || undefined,
    });
  }

  function toggleGallery(photoUrl: string) {
    setGalleryUrls((set) => {
      const next = new Set(set);
      if (next.has(photoUrl)) next.delete(photoUrl);
      else next.add(photoUrl);
      return next;
    });
  }

  function setAsHero(photoUrl: string) {
    setHeroUrl((current) => (current === photoUrl ? null : photoUrl));
    // Remove from gallery if it's becoming the hero (to avoid duplicate import)
    setGalleryUrls((set) => {
      const next = new Set(set);
      next.delete(photoUrl);
      return next;
    });
  }

  return (
    <section className="rounded-3xl border-2 border-brand/30 bg-gradient-to-br from-brand/5 via-white to-white shadow-soft p-6 md:p-8 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">
            Build from their existing site
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand text-brand-fg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            <Crown className="h-2.5 w-2.5" /> Pro
          </span>
        </div>
      </div>

      <p className="text-sm text-surface-700">
        Got their existing website (or Yelp page, or Facebook)? Paste the URL and
        we&apos;ll pull their about, services, menu, photos, hours, contact — then
        you just review and click Create.
      </p>

      <div className="grid sm:grid-cols-[1fr_auto] gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="scrape-url" className="sr-only">
            URL
          </Label>
          <Input
            id="scrape-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://theircurrentsite.com (or yelp.com/biz/...)"
            disabled={scraping}
            className="font-mono text-xs sm:text-sm"
          />
        </div>
        <Button onClick={onScrape} disabled={scraping || url.trim().length < 4} size="lg">
          {scraping ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Scraping…
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" /> Auto-fill from URL
            </>
          )}
        </Button>
      </div>

      {scraping && (
        <div className="rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sky-900">{statusMsg(elapsed)}</div>
            <div className="text-xs text-sky-700 mt-0.5 tabular-nums">
              {elapsed}s elapsed · usually 15–45s
            </div>
          </div>
        </div>
      )}

      {site && (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <Check className="h-4 w-4 text-emerald-700" />
              Scraped {new URL(site.url).hostname}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails((s) => !s)}
              >
                {showDetails ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {showDetails ? "Hide" : "Show"} preview
              </Button>
              <Button size="sm" onClick={onApplyClick}>
                <Check className="h-3.5 w-3.5" /> Apply to form
              </Button>
            </div>
          </div>

          {showDetails && (
            <ScrapePreview
              site={site}
              heroUrl={heroUrl}
              galleryUrls={galleryUrls}
              onSetHero={setAsHero}
              onToggleGallery={toggleGallery}
            />
          )}
        </div>
      )}

      <p className="text-[11px] text-surface-500 flex items-start gap-1.5">
        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
        Auto-fill replaces what&apos;s currently in the form. Apply, then edit
        anything before saving.
      </p>
    </section>
  );
}

function ScrapePreview({
  site,
  heroUrl,
  galleryUrls,
  onSetHero,
  onToggleGallery,
}: {
  site: ExtractedSite;
  heroUrl: string | null;
  galleryUrls: Set<string>;
  onSetHero: (url: string) => void;
  onToggleGallery: (url: string) => void;
}) {
  return (
    <div className="grid gap-3 text-xs">
      <Row label="Page title" value={site.pageTitle} />
      <Row label="Tagline (AI)" value={site.tagline ?? null} />
      <Row label="About (AI)" value={site.about ?? null} truncate={200} />
      <Row label="Address" value={site.address} />
      <Row label="Phone" value={site.phone} />
      <Row label="Email" value={site.email} />
      <Row
        label="Business type (AI guess)"
        value={site.businessTypeHint || null}
      />
      {site.services && site.services.length > 0 && (
        <Row
          label={`Services (${site.services.length})`}
          value={site.services
            .map(
              (s) =>
                `${s.name}${s.priceCents ? ` $${(s.priceCents / 100).toFixed(2)}` : ""}`
            )
            .slice(0, 6)
            .join(" · ") + (site.services.length > 6 ? "…" : "")}
        />
      )}
      {site.menuCategories && site.menuCategories.length > 0 && (
        <Row
          label={`Menu (${site.menuCategories.length} sections, ${site.menuCategories.reduce((s, c) => s + c.items.length, 0)} items)`}
          value={site.menuCategories.map((c) => c.name).join(" · ")}
        />
      )}
      {site.staff && site.staff.length > 0 && (
        <Row
          label={`Staff (${site.staff.length})`}
          value={site.staff.map((s) => s.name).join(" · ")}
        />
      )}
      {site.testimonials && site.testimonials.length > 0 && (
        <Row
          label={`Testimonials (${site.testimonials.length})`}
          value={`First: "${site.testimonials[0].quote.slice(0, 80)}…"`}
        />
      )}
      {site.hours && (
        <Row
          label="Hours"
          value={Object.entries(site.hours)
            .map(([d, t]) => `${d} ${t}`)
            .join(" · ")}
        />
      )}
      {site.photos.length > 0 && (
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              {site.photos.length} photos found · {heroUrl ? "1 hero" : "no hero"} +{" "}
              {galleryUrls.size} gallery selected
            </div>
            <div className="text-[10px] text-emerald-700">
              Click ★ to pick hero · click ✓ to toggle gallery
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {site.photos.slice(0, 18).map((p, i) => {
              const isHero = heroUrl === p;
              const inGallery = galleryUrls.has(p);
              return (
                <div
                  key={i}
                  className={cn(
                    "group relative aspect-square rounded-lg overflow-hidden bg-white ring-2 transition",
                    isHero
                      ? "ring-amber-500"
                      : inGallery
                        ? "ring-emerald-500"
                        : "ring-emerald-200 hover:ring-emerald-400"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p}
                    alt={`Scraped photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 bg-surface-900/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSetHero(p)}
                      className={cn(
                        "h-7 w-7 grid place-items-center rounded-full transition",
                        isHero
                          ? "bg-amber-500 text-white"
                          : "bg-white/90 text-surface-800 hover:bg-amber-500 hover:text-white"
                      )}
                      title={isHero ? "Unset hero" : "Set as hero"}
                    >
                      <Star className={cn("h-3.5 w-3.5", isHero && "fill-white")} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleGallery(p)}
                      disabled={isHero}
                      className={cn(
                        "h-7 w-7 grid place-items-center rounded-full transition disabled:opacity-30",
                        inGallery
                          ? "bg-emerald-500 text-white"
                          : "bg-white/90 text-surface-800 hover:bg-emerald-500 hover:text-white"
                      )}
                      title={isHero ? "Hero can't also be in gallery" : inGallery ? "Remove from gallery" : "Add to gallery"}
                    >
                      {inGallery ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {/* Persistent badges */}
                  {isHero && (
                    <div className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                      <Star className="h-2 w-2 fill-white" /> Hero
                    </div>
                  )}
                  {inGallery && !isHero && (
                    <div className="absolute top-1 left-1 h-4 w-4 grid place-items-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string | null;
  truncate?: number;
}) {
  if (!value) return null;
  const display = truncate && value.length > truncate ? value.slice(0, truncate) + "…" : value;
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] gap-2 py-1 border-b border-emerald-200 last:border-0"
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
        {label}
      </div>
      <div className="text-emerald-900 break-words">{display}</div>
    </div>
  );
}

