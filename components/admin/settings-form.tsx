"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Palette, Building2, Clock, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DAYS, parseHours, type Hours } from "@/lib/hours";
import { updateSettings } from "@/app/r/[slug]/admin/(panel)/actions";

interface SettingsFormProps {
  slug: string;
  initial: {
    name: string;
    tagline: string | null;
    description: string | null;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string;
    email: string | null;
    primaryColor: string;
    accentColor: string;
    taxBps: number;
    hours: string;
  };
}

export function SettingsForm({ slug, initial }: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: initial.name,
    tagline: initial.tagline ?? "",
    description: initial.description ?? "",
    address: initial.address,
    city: initial.city ?? "",
    state: initial.state ?? "",
    zip: initial.zip ?? "",
    phone: initial.phone,
    email: initial.email ?? "",
    primaryColor: initial.primaryColor,
    accentColor: initial.accentColor,
    taxPct: (initial.taxBps / 100).toFixed(2),
  });
  const [hours, setHours] = React.useState<Hours>(parseHours(initial.hours));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const taxBps = Math.round(parseFloat(form.taxPct || "0") * 100);
    if (Number.isNaN(taxBps) || taxBps < 0 || taxBps > 2000) {
      toast.error("Tax rate must be between 0% and 20%");
      return;
    }
    setSaving(true);
    try {
      const res = await updateSettings({
        slug,
        name: form.name,
        tagline: form.tagline || null,
        description: form.description || null,
        address: form.address,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone,
        email: form.email || null,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        taxBps,
        hours: JSON.stringify(hours),
      });
      if (res.ok) {
        toast.success("Settings saved");
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

  function setDayField<K extends keyof Hours["mon"]>(
    day: keyof Hours,
    field: K,
    value: Hours["mon"][K]
  ) {
    setHours((h) => ({ ...h, [day]: { ...h[day], [field]: value } }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-4xl">
      <Section icon={<Building2 className="h-4 w-4" />} title="Restaurant info">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              placeholder="One-line description for the homepage"
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={form.description}
            rows={3}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Phone" required>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Street address" required>
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            required
          />
        </Field>
        <div className="grid sm:grid-cols-3 gap-5">
          <Field label="City">
            <Input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </Field>
          <Field label="State">
            <Input
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </Field>
          <Field label="ZIP">
            <Input
              value={form.zip}
              onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
            />
          </Field>
        </div>
      </Section>

      <Section icon={<Clock className="h-4 w-4" />} title="Hours">
        <div className="divide-y divide-surface-100 rounded-2xl border border-surface-200 bg-white overflow-hidden">
          {DAYS.map((d) => {
            const day = hours[d.key];
            return (
              <div
                key={d.key}
                className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_auto_1fr_1fr] items-center gap-3 px-4 py-3"
              >
                <div className="font-medium text-surface-800">{d.label}</div>
                <div className="flex items-center gap-2 sm:justify-end col-span-1 sm:col-span-1">
                  <span className="text-xs text-surface-500">
                    {day.closed ? "Closed" : "Open"}
                  </span>
                  <Switch
                    checked={!day.closed}
                    onCheckedChange={(open) => setDayField(d.key, "closed", !open)}
                    aria-label={`${d.label} open`}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Input
                    type="time"
                    value={day.open}
                    onChange={(e) => setDayField(d.key, "open", e.target.value)}
                    disabled={day.closed}
                    className="h-9"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Input
                    type="time"
                    value={day.close}
                    onChange={(e) => setDayField(d.key, "close", e.target.value)}
                    disabled={day.closed}
                    className="h-9"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={<Palette className="h-4 w-4" />} title="Branding">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Primary color">
            <ColorInput
              value={form.primaryColor}
              onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))}
            />
          </Field>
          <Field label="Accent color">
            <ColorInput
              value={form.accentColor}
              onChange={(v) => setForm((f) => ({ ...f, accentColor: v }))}
            />
          </Field>
        </div>
        <div className="rounded-2xl bg-surface-50 px-4 py-3 text-xs text-surface-600">
          Changes show on the public site as soon as you save.
        </div>
      </Section>

      <Section icon={<Percent className="h-4 w-4" />} title="Tax">
        <Field label="Sales tax rate (%)">
          <Input
            inputMode="decimal"
            value={form.taxPct}
            onChange={(e) => setForm((f) => ({ ...f, taxPct: e.target.value }))}
            placeholder="8.65"
            className="max-w-32"
          />
        </Field>
        <p className="text-xs text-surface-500">
          Applied to subtotal at checkout. Store the rate that matches your jurisdiction.
        </p>
      </Section>

      <div className="sticky bottom-4 bg-white border border-surface-200 rounded-2xl px-5 py-3 shadow-elevated flex items-center justify-between gap-4">
        <div className="text-sm text-surface-600">
          Unsaved changes will be lost if you leave this page.
        </div>
        <Button type="submit" disabled={saving} size="md">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <span className="text-brand">{icon}</span>
        <span className="uppercase tracking-wider text-xs">{title}</span>
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
        placeholder="#C8542C"
      />
    </div>
  );
}
