"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  Crown,
  Star,
  Image as ImageIcon,
  X,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { scrapeBusinessSiteAction } from "@/app/app/scrape/actions";
import { enrichRestaurantFromScrape } from "@/app/app/clients/[slug]/actions";
import type { ExtractedSite } from "@/lib/auto-scrape";

interface Props {
  slug: string;
  current: {
    name: string;
    tagline: string | null;
    heroHeadline: string | null;
    heroSubhead: string | null;
    aboutCopy: string | null;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string;
    email: string | null;
    type: string;
    heroImageUrl: string | null;
  };
}

type FieldKey =
  | "tagline"
  | "heroHeadline"
  | "heroSubhead"
  | "aboutCopy"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "phone"
  | "email";

const FIELD_LABELS: Record<FieldKey, string> = {
  tagline: "Tagline",
  heroHeadline: "Hero headline",
  heroSubhead: "Hero subhead",
  aboutCopy: "About copy",
  address: "Address",
  city: "City",
  state: "State",
  zip: "Zip",
  phone: "Phone",
  email: "Email",
};

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
  return [...urls].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function EnrichCard({ slug, current }: Props) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [scraping, setScraping] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [site, setSite] = React.useState<ExtractedSite | null>(null);
  const [picked, setPicked] = React.useState<Set<FieldKey>>(new Set());
  const [heroUrl, setHeroUrl] = React.useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = React.useState<Set<string>>(new Set());
  const [applying, setApplying] = React.useState(false);

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

  // Build field comparison rows whenever a new site arrives
  const fieldRows = React.useMemo(() => {
    if (!site) return [];
    return ([
      ["tagline", site.tagline ?? null, current.tagline],
      ["heroHeadline", null, current.heroHeadline], // hero copy isn't directly in scrape
      ["heroSubhead", null, current.heroSubhead],
      ["aboutCopy", site.about ?? null, current.aboutCopy],
      ["address", site.address, current.address],
      ["phone", site.phone, current.phone],
      ["email", site.email, current.email],
    ] as Array<[FieldKey, string | null, string | null]>).filter(
      ([_k, scraped]) => scraped && scraped.trim().length > 0
    );
  }, [site, current]);

  async function onScrape() {
    if (scraping) return;
    if (url.trim().length < 4) {
      toast.error("Paste a URL first");
      return;
    }
    setScraping(true);
    setSite(null);
    setPicked(new Set());
    setHeroUrl(null);
    setGalleryUrls(new Set());
    try {
      const res = await scrapeBusinessSiteAction({
        url: url.trim(),
        knownBusinessName: current.name,
        knownBusinessType: current.type,
      });
      if (res.ok) {
        setSite(res.site);
        // Pre-tick fields where we have new data AND current is blank
        const auto = new Set<FieldKey>();
        if (res.site.tagline && !current.tagline) auto.add("tagline");
        if (res.site.about && !current.aboutCopy) auto.add("aboutCopy");
        if (res.site.address && !current.address) auto.add("address");
        if (res.site.phone && !current.phone) auto.add("phone");
        if (res.site.email && !current.email) auto.add("email");
        setPicked(auto);
        // Pre-pick a hero if current is missing one
        const defaultHero = !current.heroImageUrl
          ? pickHeroDefault(res.site.photos)
          : null;
        setHeroUrl(defaultHero);
        setGalleryUrls(
          new Set(
            res.site.photos
              .filter((p) => p !== defaultHero)
              .slice(0, 8)
          )
        );
        toast.success("Scraped", {
          description: `${res.site.photos.length} photos, ${fieldRows.length || "0"} text fields found.`,
        });
      } else {
        const isUpgrade = /Pro feature|Upgrade in Billing/i.test(res.error);
        toast.error(res.error, {
          duration: 6000,
          action: isUpgrade
            ? { label: "Upgrade", onClick: () => (window.location.href = "/app/billing") }
            : undefined,
        });
      }
    } finally {
      setScraping(false);
    }
  }

  function togglePicked(k: FieldKey) {
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleGallery(u: string) {
    setGalleryUrls((set) => {
      const next = new Set(set);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  }

  async function onApply() {
    if (!site || applying) return;
    const fieldUpdates: Record<string, string | null> = {};
    if (picked.has("tagline")) fieldUpdates.tagline = site.tagline ?? null;
    if (picked.has("aboutCopy")) fieldUpdates.aboutCopy = site.about ?? null;
    if (picked.has("address")) fieldUpdates.address = site.address ?? null;
    if (picked.has("phone")) fieldUpdates.phone = site.phone ?? null;
    if (picked.has("email")) fieldUpdates.email = site.email ?? null;

    const hasFieldChange = Object.keys(fieldUpdates).length > 0;
    const hasHero = !!heroUrl;
    const hasGallery = galleryUrls.size > 0;
    if (!hasFieldChange && !hasHero && !hasGallery) {
      toast.error("Nothing selected to merge — tick what you want to apply.");
      return;
    }

    setApplying(true);
    try {
      const res = await enrichRestaurantFromScrape({
        slug,
        fields: fieldUpdates,
        heroPhotoUrl: heroUrl,
        galleryPhotoUrls: Array.from(galleryUrls),
      });
      if (res.ok) {
        const bits: string[] = [];
        if (res.fieldsUpdated.length > 0) {
          bits.push(`${res.fieldsUpdated.length} field${res.fieldsUpdated.length === 1 ? "" : "s"}`);
        }
        if (res.heroReplaced) bits.push("hero image");
        if (res.galleryAdded > 0) bits.push(`${res.galleryAdded} gallery photo${res.galleryAdded === 1 ? "" : "s"}`);
        toast.success(`Merged: ${bits.join(" + ") || "nothing changed"}`);
        // Reset
        setSite(null);
        setUrl("");
        setPicked(new Set());
        setHeroUrl(null);
        setGalleryUrls(new Set());
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Merge failed");
      }
    } finally {
      setApplying(false);
    }
  }

  function statusMsg(s: number): string {
    if (s < 3) return "Fetching the page…";
    if (s < 8) return "Pulling photos + structured data…";
    if (s < 20) return "Claude is extracting services + menu…";
    if (s < 35) return "Almost done — long sites take a sec…";
    return "Still working…";
  }

  return (
    <section className="rounded-3xl border-2 border-brand/30 bg-gradient-to-br from-brand/5 via-white to-white shadow-soft p-6 md:p-8 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <Wand2 className="h-4 w-4 text-brand" />
        <span className="uppercase tracking-wider text-xs">Enrich from another URL</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand text-brand-fg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          <Crown className="h-2.5 w-2.5" /> Pro
        </span>
      </div>
      <p className="text-sm text-surface-700">
        Found their old website? Their Yelp page? A Facebook business page?
        Paste the URL — we pull what&apos;s missing and you pick what to merge.
      </p>

      <div className="grid sm:grid-cols-[1fr_auto] gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://theirsite.com (or yelp.com/biz/..., facebook.com/...)"
          disabled={scraping}
          className="font-mono text-xs sm:text-sm"
        />
        <Button onClick={onScrape} disabled={scraping || url.trim().length < 4}>
          {scraping ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Scraping…
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" /> Scrape
            </>
          )}
        </Button>
      </div>

      {scraping && (
        <div className="rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-700 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-sky-900">{statusMsg(elapsed)}</div>
            <div className="text-xs text-sky-700 mt-0.5 tabular-nums">
              {elapsed}s elapsed
            </div>
          </div>
        </div>
      )}

      {site && (
        <div className="rounded-2xl bg-white ring-1 ring-surface-200 p-5 space-y-5">
          {fieldRows.length === 0 ? (
            <div className="text-sm text-surface-600">
              No new text fields found on that page (it may already match what
              you have). Photos might still be worth grabbing below.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider font-medium text-surface-500">
                Text fields — tick to merge
              </div>
              {fieldRows.map(([key, scraped, currentVal]) => (
                <FieldDiffRow
                  key={key}
                  label={FIELD_LABELS[key]}
                  scraped={scraped}
                  currentVal={currentVal}
                  picked={picked.has(key)}
                  onToggle={() => togglePicked(key)}
                />
              ))}
            </div>
          )}

          {site.photos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs uppercase tracking-wider font-medium text-surface-500">
                  Photos · {heroUrl ? "1 hero replace" : "no hero"} + {galleryUrls.size} gallery selected
                </div>
                {current.heroImageUrl && heroUrl && (
                  <span className="text-[10px] text-amber-700 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Will REPLACE current hero
                  </span>
                )}
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
                            : "ring-surface-200 hover:ring-surface-400"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p}
                        alt={`Scraped photo ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-surface-900/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setHeroUrl((cur) => (cur === p ? null : p))
                          }
                          className={cn(
                            "h-7 w-7 grid place-items-center rounded-full transition",
                            isHero
                              ? "bg-amber-500 text-white"
                              : "bg-white/90 text-surface-800 hover:bg-amber-500 hover:text-white"
                          )}
                          title={isHero ? "Unset hero" : "Replace hero with this"}
                        >
                          <Star className={cn("h-3.5 w-3.5", isHero && "fill-white")} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleGallery(p)}
                          disabled={isHero}
                          className={cn(
                            "h-7 w-7 grid place-items-center rounded-full transition disabled:opacity-30",
                            inGallery
                              ? "bg-emerald-500 text-white"
                              : "bg-white/90 text-surface-800 hover:bg-emerald-500 hover:text-white"
                          )}
                          title={isHero ? "Hero can't also be gallery" : inGallery ? "Remove from gallery" : "Add to gallery"}
                        >
                          {inGallery ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
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

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => {
                setSite(null);
                setUrl("");
              }}
              className="text-xs text-surface-500 hover:text-surface-800 inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Discard
            </button>
            <Button onClick={onApply} disabled={applying}>
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Merging…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Merge into site
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function FieldDiffRow({
  label,
  scraped,
  currentVal,
  picked,
  onToggle,
}: {
  label: string;
  scraped: string | null;
  currentVal: string | null;
  picked: boolean;
  onToggle: () => void;
}) {
  const trim = (s: string | null, n: number) =>
    s && s.length > n ? s.slice(0, n) + "…" : s;
  return (
    <label
      className={cn(
        "block rounded-xl border-2 p-3 transition cursor-pointer",
        picked
          ? "border-brand bg-brand/5"
          : "border-surface-200 bg-white hover:border-surface-300"
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={picked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-surface-300 text-brand focus:ring-brand"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-surface-700">{label}</div>
          <div className="mt-1.5 grid sm:grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-0.5">
                Current
              </div>
              <div className="text-surface-700 break-words">
                {currentVal && currentVal.trim().length > 0 ? (
                  trim(currentVal, 160)
                ) : (
                  <span className="italic text-surface-400">(empty)</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-700 mb-0.5">
                Scraped
              </div>
              <div className="text-emerald-900 break-words">{trim(scraped, 160)}</div>
            </div>
          </div>
        </div>
      </div>
    </label>
  );
}
