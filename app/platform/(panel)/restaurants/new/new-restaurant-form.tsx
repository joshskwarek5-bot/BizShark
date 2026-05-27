"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Palette, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, slugify, parseMoneyToCents } from "@/lib/utils";
import {
  CLIENT_TYPES,
  CLIENT_TYPE_META,
  type ClientType,
  type ServiceItem,
} from "@/lib/client-type";
import {
  BUSINESS_TYPE_META,
  type BusinessType,
} from "@/lib/business-types";
import {
  FEATURE_META,
  FEATURE_KEYS,
  normalizeFeatures,
  type FeatureKey,
} from "@/lib/features";
import { createRestaurant, type CreateRestaurantInput } from "@/app/platform/(panel)/actions";
import { AIAssist, type AIGeneratedCopy } from "./ai-assist";
import {
  TemplateThumbnail,
  type TemplateThumbnailId,
} from "@/components/templates/template-thumbnail";
import { AutoScrapeCard, type ScrapeSelection } from "@/components/operator/auto-scrape-card";
import { guessBusinessType } from "@/lib/business-types";

// Template options — kept in sync with lib/templates.ts. Listed inline so
// this client component doesn't import server-only modules.
const TEMPLATE_PICKER_OPTIONS: ReadonlyArray<{
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
  {
    id: "bold",
    label: "Bold",
    description:
      "High-contrast, full-bleed photography, massive sans display, sharp corners. Built for gyms, breweries, modern restaurants.",
  },
  {
    id: "refined",
    label: "Refined",
    description:
      "Editorial layout, hairline rules, tracked-out small caps, generous whitespace. Quiet authority for healthcare, professional services, fine dining, spas.",
  },
] as const;

// Used for "See it live" preview before any restaurant of the operator's own
// exists. Mama Bears is seeded and always available, so it's a safe demo.
const DEMO_SLUG = "mama-bears";

export interface CreateActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, unknown> | undefined;
  restaurant?: { slug: string };
}

export type CreateActionFn = (input: CreateRestaurantInput) => Promise<CreateActionResult>;

export interface InitialFormValues {
  type?: ClientType;
  name?: string;
  slug?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
}

export function NewRestaurantForm({
  aiAvailable,
  createAction = createRestaurant,
  successHref,
  initialValues,
  notice,
  leadId,
  adminRequired = true,
  showAutoScrape = false,
}: {
  aiAvailable: boolean;
  /** Show the Pro-tier auto-scrape card at the top of the form. */
  showAutoScrape?: boolean;
  /** Defaults to the super_admin `createRestaurant`. Operators pass their own. */
  createAction?: CreateActionFn;
  /** Where to send the user after creation. Defaults to /r/<slug>. */
  successHref?: (slug: string) => string;
  /** Pre-fill form fields (e.g. from a lead). */
  initialValues?: InitialFormValues;
  /** Optional banner shown at the top of the form (e.g. "Pre-filled from lead X"). */
  notice?: React.ReactNode;
  /** When converting a lead, the operator-scoped Lead id to mark converted. */
  leadId?: string;
  /**
   * Whether admin email + password are required. True for super_admin
   * (creates client + their first user in one shot). False for operators
   * who keep ownership and may hand off later via a setup link.
   */
  adminRequired?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [saveElapsed, setSaveElapsed] = React.useState(0);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initialValues?.slug));

  // Rotate a status message while saving so the operator knows the request
  // is still alive during the 30s AI hero generation.
  React.useEffect(() => {
    if (!saving) {
      setSaveElapsed(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(
      () => setSaveElapsed(Math.floor((Date.now() - start) / 1000)),
      500
    );
    return () => clearInterval(t);
  }, [saving]);

  function saveStatus(s: number): string {
    if (s < 3) return "Creating client…";
    if (s < 8) return "Saving the basics…";
    if (s < 15) return "Importing scraped photos…";
    if (s < 30) return "Generating AI hero image…";
    if (s < 50) return "Still painting the hero — almost there…";
    return "Wrapping up — large hero takes a moment…";
  }
  const [type, setType] = React.useState<ClientType>(initialValues?.type ?? "restaurant");
  const [templateId, setTemplateId] = React.useState<string>("modern");
  const [services, setServices] = React.useState<ServiceItem[]>([]);
  const [features, setFeatures] = React.useState<Set<FeatureKey>>(
    () =>
      new Set(
        BUSINESS_TYPE_META[
          (initialValues?.type ?? "restaurant") as BusinessType
        ].defaultFeatures
      )
  );
  const [form, setForm] = React.useState({
    name: initialValues?.name ?? "",
    slug: initialValues?.slug ?? (initialValues?.name ? slugify(initialValues.name) : ""),
    tagline: "",
    heroHeadline: "",
    heroSubhead: "",
    aboutCopy: "",
    address: initialValues?.address ?? "",
    city: initialValues?.city ?? "",
    state: initialValues?.state ?? "",
    zip: initialValues?.zip ?? "",
    phone: initialValues?.phone ?? "",
    email: initialValues?.email ?? "",
    primaryColor: "#C8542C",
    accentColor: "#2D5A3D",
    taxPct: "8.65",
    adminEmail: "",
    adminName: "",
    adminPassword: "",
  });

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }
  function onNameChange(name: string) {
    update("name", name);
    if (!slugTouched) update("slug", slugify(name));
  }

  function addService() {
    setServices((s) => [
      ...s,
      {
        id: Math.random().toString(36).slice(2, 10),
        name: "",
        description: "",
        priceCents: null,
        duration: null,
      },
    ]);
  }
  function updateService(id: string, patch: Partial<ServiceItem>) {
    setServices((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeService(id: string) {
    setServices((s) => s.filter((x) => x.id !== id));
  }

  function applyAI(copy: AIGeneratedCopy) {
    setForm((f) => ({
      ...f,
      tagline: copy.tagline,
      heroHeadline: copy.heroHeadline,
      heroSubhead: copy.heroSubhead,
      aboutCopy: copy.aboutCopy,
      primaryColor: copy.primaryColor,
      accentColor: copy.accentColor,
    }));
    if (type === "service_business" && copy.services.length > 0) {
      setServices(copy.services);
    }
  }

  // Scraped photo URLs queued for ingest after the restaurant is created
  const [scrapedHeroUrl, setScrapedHeroUrl] = React.useState<string | null>(null);
  const [scrapedGalleryUrls, setScrapedGalleryUrls] = React.useState<string[]>([]);

  function applyScrape({ site, heroPhotoUrl, galleryPhotoUrls }: ScrapeSelection) {
    // Map scraped data onto the form fields. Don't overwrite anything the
    // operator already typed — only fill blanks.
    setForm((f) => ({
      ...f,
      name: f.name || site.pageTitle?.split(/[|·—-]/)[0].trim() || f.name,
      slug: f.slug || (site.pageTitle ? slugify(site.pageTitle.split(/[|·—-]/)[0].trim()) : f.slug),
      tagline: f.tagline || site.tagline || f.tagline,
      aboutCopy: f.aboutCopy || site.about || f.aboutCopy,
      address: f.address || site.address || f.address,
      phone: f.phone || site.phone || f.phone,
      email: f.email || site.email || f.email,
    }));
    // Switch business type if AI inferred one and operator hasn't manually picked
    if (site.businessTypeHint && (site.businessTypeHint as string).length > 0) {
      const guessed = site.businessTypeHint as ClientType;
      setType(guessed);
      setFeatures(
        new Set(BUSINESS_TYPE_META[guessed as BusinessType].defaultFeatures)
      );
    }
    // Seed services if it's a service-type business
    if (site.services && site.services.length > 0 && type !== "restaurant") {
      setServices(
        site.services.slice(0, 8).map((s, i) => ({
          id: `scrape-${Date.now()}-${i}`,
          name: s.name,
          description: s.description ?? "",
          priceCents: s.priceCents ?? null,
          duration: s.duration ?? null,
        }))
      );
    }
    // Queue photo URLs for post-create ingestion
    setScrapedHeroUrl(heroPhotoUrl);
    setScrapedGalleryUrls(galleryPhotoUrls);
  }
  // Keep guessBusinessType import alive for future use
  void guessBusinessType;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const taxBps =
      type === "restaurant" ? Math.round(parseFloat(form.taxPct || "0") * 100) : 0;
    if (type === "restaurant" && (Number.isNaN(taxBps) || taxBps < 0 || taxBps > 2000)) {
      toast.error("Tax rate must be between 0% and 20%");
      return;
    }
    // Admin credentials are optional for the operator flow. Only enforce the
    // 8-char rule when an admin email is being set.
    const adminEmailSet = form.adminEmail.trim().length > 0;
    if (adminEmailSet && form.adminPassword.length < 8) {
      toast.error("Admin password must be at least 8 characters");
      return;
    }
    if (!adminEmailSet && form.adminPassword.length > 0 && form.adminPassword.length < 8) {
      toast.error("Admin password must be at least 8 characters (or leave both blank)");
      return;
    }
    const cleanedServices = services
      .map((s) => ({
        ...s,
        name: s.name.trim(),
        description: s.description?.trim() || undefined,
        duration: s.duration?.trim() || null,
      }))
      .filter((s) => s.name.length > 0);

    setSaving(true);
    try {
      const normalizedFeatures = normalizeFeatures(type as BusinessType, features);
      const res = await createAction({
        type,
        templateId,
        enabledFeatures: normalizedFeatures,
        name: form.name,
        slug: form.slug,
        tagline: form.tagline || null,
        heroHeadline: form.heroHeadline || null,
        heroSubhead: form.heroSubhead || null,
        aboutCopy: form.aboutCopy || null,
        address: form.address,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone,
        email: form.email || null,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        taxBps,
        servicesJson:
          type === "service_business" && cleanedServices.length > 0
            ? JSON.stringify(cleanedServices)
            : null,
        adminEmail: form.adminEmail,
        adminName: form.adminName || undefined,
        adminPassword: form.adminPassword,
        // Optional — only included when caller provides it
        ...(leadId ? { leadId } : {}),
        // Scraped photos (operator flow only — super_admin create ignores these)
        ...(scrapedHeroUrl ? { scrapedHeroPhotoUrl: scrapedHeroUrl } : {}),
        ...(scrapedGalleryUrls.length > 0
          ? { scrapedGalleryUrls }
          : {}),
      } as Parameters<CreateActionFn>[0]);
      if (res.ok) {
        const aiHero = (res as { aiHeroGenerated?: boolean }).aiHeroGenerated;
        toast.success(`${form.name} created`, {
          description: aiHero
            ? "AI hero image generated and set as your landing-page centerpiece."
            : undefined,
        });
        router.push(successHref ? successHref(form.slug) : `/r/${form.slug}`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not create");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {notice}
      {showAutoScrape && (
        <AutoScrapeCard
          knownBusinessName={form.name || undefined}
          knownBusinessType={type}
          onApply={applyScrape}
        />
      )}
      <Section title="Business type">
        <p className="text-sm text-surface-500 -mt-2">
          Drives default features + AI copy tone. You can flip individual
          features on/off below.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CLIENT_TYPES.map((key) => {
            const meta = BUSINESS_TYPE_META[key as BusinessType];
            const active = type === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setType(key);
                  // Reset features to the new type's defaults when switching
                  setFeatures(new Set(BUSINESS_TYPE_META[key as BusinessType].defaultFeatures));
                }}
                className={cn(
                  "text-left rounded-2xl border-2 p-4 transition-all",
                  active
                    ? "border-brand bg-brand/5 shadow-soft"
                    : "border-surface-200 bg-white hover:border-surface-300"
                )}
              >
                <div className="font-display text-sm text-surface-900">
                  {meta.label}
                </div>
                <p className="mt-1.5 text-xs text-surface-600 leading-snug">
                  {meta.description}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-surface-400">
                  {meta.examples.slice(0, 3).join(" · ")}
                </p>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Site features">
        <p className="text-sm text-surface-500 -mt-2">
          Toggle what shows on the public site. Defaults match the business type
          — change anytime from the admin.
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {FEATURE_KEYS.filter((k) =>
            FEATURE_META[k].applicableTo.includes(type as BusinessType)
          ).map((key) => {
            const meta = FEATURE_META[key];
            const on = features.has(key);
            const locked = meta.alwaysOn;
            return (
              <button
                key={key}
                type="button"
                disabled={locked}
                onClick={() => {
                  setFeatures((set) => {
                    const next = new Set(set);
                    if (next.has(key)) {
                      next.delete(key);
                      for (const k of Array.from(next)) {
                        if ((FEATURE_META[k].requires ?? []).includes(key)) {
                          next.delete(k);
                        }
                      }
                    } else {
                      next.add(key);
                      for (const dep of meta.requires ?? []) next.add(dep);
                    }
                    return next;
                  });
                }}
                className={cn(
                  "text-left rounded-xl border-2 p-3 transition-all",
                  on
                    ? "border-brand bg-brand/5"
                    : "border-surface-200 bg-white hover:border-surface-300",
                  locked && "opacity-80 cursor-default"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-surface-900">
                    {meta.label}
                  </span>
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full border-2 transition",
                      on ? "border-brand bg-brand" : "border-surface-300"
                    )}
                  >
                    {on && <span className="block m-0.5 h-1 w-1 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="mt-1 text-xs text-surface-600 leading-snug">
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Website template">
        <p className="text-sm text-surface-500 -mt-2 flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-brand" />
          Pick the look. You can swap templates later from the admin.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {TEMPLATE_PICKER_OPTIONS.map((t) => {
            const active = templateId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-2xl border-2 transition-all overflow-hidden",
                  active
                    ? "border-brand bg-brand/5 shadow-soft"
                    : "border-surface-200 bg-white hover:border-surface-300"
                )}
              >
                <button
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className="block w-full text-left"
                >
                  <div className="bg-surface-100">
                    <TemplateThumbnail
                      id={t.id}
                      primary={form.primaryColor}
                      accent={form.accentColor}
                      className="w-full h-auto block"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-display text-lg text-surface-900">{t.label}</div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border-2 transition",
                          active ? "border-brand bg-brand" : "border-surface-300"
                        )}
                      >
                        {active && <div className="m-1 h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="mt-1.5 text-sm text-surface-600">{t.description}</p>
                  </div>
                </button>
                <div className="px-4 pb-4 -mt-1">
                  <a
                    href={`/r/${DEMO_SLUG}?previewTemplate=${t.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                  >
                    See {t.label.toLowerCase()} live <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Basics">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Business name" required>
            <Input value={form.name} onChange={(e) => onNameChange(e.target.value)} required />
          </Field>
          <Field label="URL slug" required>
            <div className="flex items-center gap-1 rounded-xl border border-surface-200 bg-white shadow-crisp pl-3 h-11">
              <span className="text-sm text-surface-400">/r/</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update("slug", slugify(e.target.value));
                }}
                required
                className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
                placeholder="my-business"
              />
            </div>
          </Field>
        </div>
      </Section>

      <AIAssist
        type={type}
        businessName={form.name}
        city={form.city}
        available={aiAvailable}
        onApply={applyAI}
      />

      <Section title="Marketing copy">
        <Field label="Tagline">
          <Input
            value={form.tagline}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="One-line description shown under the business name"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Hero headline">
            <Input
              value={form.heroHeadline}
              onChange={(e) => update("heroHeadline", e.target.value)}
              placeholder="The big phrase at the top"
            />
          </Field>
          <Field label="Hero subhead">
            <Input
              value={form.heroSubhead}
              onChange={(e) => update("heroSubhead", e.target.value)}
              placeholder="Supporting line under the headline"
            />
          </Field>
        </div>
        <Field label="About / story">
          <Textarea
            value={form.aboutCopy}
            onChange={(e) => update("aboutCopy", e.target.value)}
            rows={6}
            placeholder="Two to four short paragraphs about the business."
          />
        </Field>
      </Section>

      <Section title="Contact">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Phone" required>
            <Input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              required
              type="tel"
            />
          </Field>
          <Field label="Email">
            <Input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              type="email"
            />
          </Field>
        </div>
        <Field label="Street address" required>
          <Input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            required
          />
        </Field>
        <div className="grid sm:grid-cols-3 gap-5">
          <Field label="City">
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="State">
            <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
          </Field>
          <Field label="ZIP">
            <Input value={form.zip} onChange={(e) => update("zip", e.target.value)} />
          </Field>
        </div>
      </Section>

      {type === "service_business" && (
        <Section title="Services">
          <p className="text-sm text-surface-500 -mt-2">
            Add a few core services. AI generates these if you used the assist above.
          </p>
          {services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-8 text-center text-sm text-surface-500">
              No services yet —{" "}
              <button
                type="button"
                onClick={addService}
                className="text-brand font-medium hover:underline"
              >
                add one
              </button>
              .
            </div>
          ) : (
            <ul className="space-y-3">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-surface-200 bg-white p-4 grid gap-3 md:grid-cols-[1fr_160px_140px_auto]"
                >
                  <Input
                    value={s.name}
                    onChange={(e) => updateService(s.id, { name: e.target.value })}
                    placeholder="Service name (e.g. Haircut)"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                      $
                    </span>
                    <Input
                      inputMode="decimal"
                      placeholder="Price (optional)"
                      value={s.priceCents != null ? (s.priceCents / 100).toFixed(2) : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") updateService(s.id, { priceCents: null });
                        else {
                          const cents = parseMoneyToCents(v);
                          if (cents !== null) updateService(s.id, { priceCents: cents });
                        }
                      }}
                      className="pl-7"
                    />
                  </div>
                  <Input
                    value={s.duration ?? ""}
                    onChange={(e) => updateService(s.id, { duration: e.target.value })}
                    placeholder="Duration (e.g. 45min)"
                  />
                  <button
                    type="button"
                    onClick={() => removeService(s.id)}
                    className="self-center h-9 w-9 grid place-items-center rounded-full text-surface-400 hover:bg-red-50 hover:text-red-600 transition"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addService}>
            <Plus className="h-4 w-4" /> Add service
          </Button>
        </Section>
      )}

      <Section title="Branding">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Primary color">
            <ColorInput value={form.primaryColor} onChange={(v) => update("primaryColor", v)} />
          </Field>
          <Field label="Accent color">
            <ColorInput value={form.accentColor} onChange={(v) => update("accentColor", v)} />
          </Field>
        </div>
        {type === "restaurant" && (
          <Field label="Sales tax rate (%)">
            <Input
              value={form.taxPct}
              onChange={(e) => update("taxPct", e.target.value)}
              inputMode="decimal"
              className="max-w-32"
            />
          </Field>
        )}
      </Section>

      <Section
        title={adminRequired ? "First admin user" : "Hand off later (optional)"}
      >
        <p className="text-sm text-surface-500 -mt-2">
          {adminRequired
            ? "The business owner signs in with this email. You can also use your super-admin to act-as."
            : "Skip this — you own the site and can hand it off later from the client's page. Or set up the client's login now."}
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Admin email" required={adminRequired}>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => update("adminEmail", e.target.value)}
              required={adminRequired}
              autoComplete="off"
              placeholder={adminRequired ? "" : "owner@business.com (optional)"}
            />
          </Field>
          <Field label="Admin name">
            <Input
              value={form.adminName}
              onChange={(e) => update("adminName", e.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
        <Field label="Temporary password" required={adminRequired}>
          <Input
            type="text"
            value={form.adminPassword}
            onChange={(e) => update("adminPassword", e.target.value)}
            required={adminRequired}
            autoComplete="new-password"
            placeholder={
              adminRequired ? "At least 8 characters" : "Leave blank to skip"
            }
          />
        </Field>
      </Section>

      <div className="sticky bottom-4 bg-white border border-surface-200 rounded-2xl px-5 py-3 shadow-elevated flex items-center justify-between gap-4">
        <div className="text-sm text-surface-600">
          {scrapedHeroUrl || scrapedGalleryUrls.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {scrapedHeroUrl ? "1 hero + " : ""}
              {scrapedGalleryUrls.length} photo
              {scrapedGalleryUrls.length === 1 ? "" : "s"} will import after create
            </span>
          ) : (
            "You'll be taken straight to the live landing page."
          )}
        </div>
        <Button type="submit" disabled={saving} size="md">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Creating…" : `Create ${CLIENT_TYPE_META[type].label.toLowerCase()}`}
        </Button>
      </div>
      {saving && (
        <div className="rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sky-900">
              {saveStatus(saveElapsed)}
            </div>
            <div className="text-xs text-sky-700 mt-0.5 tabular-nums">
              {saveElapsed}s elapsed · keep this tab open
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
      <div className="text-xs font-medium uppercase tracking-wider text-surface-500">
        {title}
      </div>
      {children}
    </section>
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

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-3 h-11 shadow-crisp">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 rounded-md border border-surface-200 bg-transparent cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent font-mono text-sm focus:outline-none"
      />
    </div>
  );
}
