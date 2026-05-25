"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Utensils, Sparkles, Plus, Trash2, Palette } from "lucide-react";
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
import { createRestaurant, type CreateRestaurantInput } from "@/app/platform/(panel)/actions";
import { AIAssist, type AIGeneratedCopy } from "./ai-assist";

// Template options — kept in sync with lib/templates.ts. Listed inline so
// this client component doesn't import server-only modules.
const TEMPLATE_PICKER_OPTIONS = [
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
] as const;

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
}: {
  aiAvailable: boolean;
  /** Defaults to the super_admin `createRestaurant`. Operators pass their own. */
  createAction?: CreateActionFn;
  /** Where to send the user after creation. Defaults to /r/<slug>. */
  successHref?: (slug: string) => string;
  /** Pre-fill form fields (e.g. from a lead). */
  initialValues?: InitialFormValues;
  /** Optional banner shown at the top of the form (e.g. "Pre-filled from lead X"). */
  notice?: React.ReactNode;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initialValues?.slug));
  const [type, setType] = React.useState<ClientType>(initialValues?.type ?? "restaurant");
  const [templateId, setTemplateId] = React.useState<string>("modern");
  const [services, setServices] = React.useState<ServiceItem[]>([]);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const taxBps =
      type === "restaurant" ? Math.round(parseFloat(form.taxPct || "0") * 100) : 0;
    if (type === "restaurant" && (Number.isNaN(taxBps) || taxBps < 0 || taxBps > 2000)) {
      toast.error("Tax rate must be between 0% and 20%");
      return;
    }
    if (form.adminPassword.length < 8) {
      toast.error("Admin password must be at least 8 characters");
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
      const res = await createAction({
        type,
        templateId,
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
      } as Parameters<CreateActionFn>[0]);
      if (res.ok) {
        toast.success(`${form.name} created`);
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
      <Section title="Client type">
        <div className="grid sm:grid-cols-2 gap-3">
          {CLIENT_TYPES.map((key) => {
            const meta = CLIENT_TYPE_META[key];
            const active = type === key;
            const Icon = key === "restaurant" ? Utensils : Sparkles;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={cn(
                  "text-left rounded-2xl border-2 p-5 transition-all",
                  active
                    ? "border-brand bg-brand/5 shadow-soft"
                    : "border-surface-200 bg-white hover:border-surface-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 grid place-items-center rounded-full",
                      active ? "bg-brand text-brand-fg" : "bg-surface-100 text-surface-600"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-display text-lg text-surface-900">{meta.label}</div>
                </div>
                <p className="mt-2.5 text-sm text-surface-600">{meta.description}</p>
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
        <div className="grid sm:grid-cols-2 gap-3">
          {TEMPLATE_PICKER_OPTIONS.map((t) => {
            const active = templateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "text-left rounded-2xl border-2 p-5 transition-all",
                  active
                    ? "border-brand bg-brand/5 shadow-soft"
                    : "border-surface-200 bg-white hover:border-surface-300"
                )}
              >
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
                <p className="mt-2 text-sm text-surface-600">{t.description}</p>
              </button>
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

      <Section title="First admin user">
        <p className="text-sm text-surface-500 -mt-2">
          The business owner signs in with this email. You can also use your super-admin to act-as.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Admin email" required>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => update("adminEmail", e.target.value)}
              required
              autoComplete="off"
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
        <Field label="Temporary password" required>
          <Input
            type="text"
            value={form.adminPassword}
            onChange={(e) => update("adminPassword", e.target.value)}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </Field>
      </Section>

      <div className="sticky bottom-4 bg-white border border-surface-200 rounded-2xl px-5 py-3 shadow-elevated flex items-center justify-between gap-4">
        <div className="text-sm text-surface-600">
          You&apos;ll be taken straight to the live landing page.
        </div>
        <Button type="submit" disabled={saving} size="md">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Creating…" : `Create ${CLIENT_TYPE_META[type].label.toLowerCase()}`}
        </Button>
      </div>
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
