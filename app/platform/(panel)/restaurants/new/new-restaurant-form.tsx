"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/utils";
import { createRestaurant } from "@/app/platform/(panel)/actions";

export function NewRestaurantForm() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    slug: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const taxBps = Math.round(parseFloat(form.taxPct || "0") * 100);
    if (Number.isNaN(taxBps) || taxBps < 0 || taxBps > 2000) {
      toast.error("Tax rate must be between 0% and 20%");
      return;
    }
    if (form.adminPassword.length < 8) {
      toast.error("Admin password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await createRestaurant({
        name: form.name,
        slug: form.slug,
        address: form.address,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone,
        email: form.email || null,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        taxBps,
        adminEmail: form.adminEmail,
        adminName: form.adminName || undefined,
        adminPassword: form.adminPassword,
      });
      if (res.ok) {
        toast.success(`${form.name} created`);
        router.push("/platform/restaurants");
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
      <Section title="Basics">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Restaurant name" required>
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
                placeholder="my-restaurant"
              />
            </div>
          </Field>
        </div>
        <Field label="Phone" required>
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required type="tel" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" />
        </Field>
      </Section>

      <Section title="Location">
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

      <Section title="Branding & tax">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Primary color">
            <ColorInput value={form.primaryColor} onChange={(v) => update("primaryColor", v)} />
          </Field>
          <Field label="Accent color">
            <ColorInput value={form.accentColor} onChange={(v) => update("accentColor", v)} />
          </Field>
        </div>
        <Field label="Sales tax rate (%)">
          <Input
            value={form.taxPct}
            onChange={(e) => update("taxPct", e.target.value)}
            inputMode="decimal"
            className="max-w-32"
          />
        </Field>
      </Section>

      <Section title="First admin user">
        <p className="text-sm text-surface-500 -mt-2">
          The restaurant owner will sign in with this email.
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
          You can tweak everything else from the restaurant&apos;s settings page.
        </div>
        <Button type="submit" disabled={saving} size="md">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Creating…" : "Create restaurant"}
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
