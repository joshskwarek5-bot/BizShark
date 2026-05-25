"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatMoney, parseMoneyToCents } from "@/lib/utils";
import { type ServiceItem } from "@/lib/client-type";
import { updateServices } from "@/app/r/[slug]/admin/(panel)/actions";

interface ServicesManagerProps {
  slug: string;
  initial: ServiceItem[];
}

export function ServicesManager({ slug, initial }: ServicesManagerProps) {
  const router = useRouter();
  const [services, setServices] = React.useState<ServiceItem[]>(initial);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  function makeId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function add() {
    setServices((s) => [
      ...s,
      { id: makeId(), name: "", description: "", priceCents: null, duration: null },
    ]);
    setDirty(true);
  }

  function update(id: string, patch: Partial<ServiceItem>) {
    setServices((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setDirty(true);
  }

  function remove(id: string) {
    setServices((s) => s.filter((x) => x.id !== id));
    setDirty(true);
  }

  function move(idx: number, dir: -1 | 1) {
    setServices((s) => {
      const arr = [...s];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return s;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
    setDirty(true);
  }

  async function save() {
    if (saving) return;
    // basic validation
    const cleaned = services
      .map((s) => ({
        id: s.id,
        name: s.name.trim(),
        description: (s.description ?? "").trim() || undefined,
        priceCents: s.priceCents ?? null,
        duration: s.duration?.trim() || null,
      }))
      .filter((s) => s.name.length > 0);
    if (cleaned.length !== services.length) {
      toast.error("Every service needs a name");
      return;
    }
    setSaving(true);
    try {
      const res = await updateServices({ slug, services: cleaned });
      if (res.ok) {
        toast.success("Services saved");
        setDirty(false);
        router.refresh();
      }
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Services</h1>
          <p className="text-sm text-surface-500 mt-1">
            Add, edit, or reorder the services shown on your public site.
          </p>
        </div>
        <Button onClick={add} variant="outline">
          <Plus className="h-4 w-4" /> Add service
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="mt-3 font-display text-2xl text-surface-900">No services yet</div>
          <p className="mt-1 text-surface-500 max-w-md mx-auto">
            Add what you offer — name, optional description, price, and how long it takes.
          </p>
          <Button className="mt-6" onClick={add}>
            <Plus className="h-4 w-4" /> Add your first service
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {services.map((s, idx) => (
            <li
              key={s.id}
              className={cn(
                "rounded-2xl border border-surface-200 bg-white shadow-soft p-5",
                "grid gap-4 lg:grid-cols-[auto_1fr_180px_180px_auto]"
              )}
            >
              <div className="flex items-center gap-1 text-surface-300">
                <GripVertical className="h-4 w-4" />
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="text-surface-400 hover:text-surface-700 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === services.length - 1}
                    className="text-surface-400 hover:text-surface-700 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 min-w-0">
                <Input
                  value={s.name}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                  placeholder="Service name"
                  className="font-medium"
                />
                <Textarea
                  value={s.description ?? ""}
                  onChange={(e) => update(s.id, { description: e.target.value })}
                  placeholder="Short description (optional)"
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Price (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                    $
                  </span>
                  <Input
                    inputMode="decimal"
                    placeholder="From / fixed"
                    value={s.priceCents != null ? (s.priceCents / 100).toFixed(2) : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") update(s.id, { priceCents: null });
                      else {
                        const cents = parseMoneyToCents(v);
                        if (cents !== null) update(s.id, { priceCents: cents });
                      }
                    }}
                    className="pl-7 h-10"
                  />
                </div>
                {s.priceCents != null && (
                  <div className="text-xs text-surface-500 font-mono">
                    Shows as {formatMoney(s.priceCents)}
                  </div>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Duration (optional)</Label>
                <Input
                  value={s.duration ?? ""}
                  onChange={(e) => update(s.id, { duration: e.target.value })}
                  placeholder="e.g. 45 min"
                  className="h-10"
                />
              </div>

              <button
                type="button"
                onClick={() => remove(s.id)}
                className="self-start h-9 w-9 grid place-items-center rounded-full text-surface-400 hover:bg-red-50 hover:text-red-600 transition"
                aria-label="Delete service"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(dirty || services.length > 0) && (
        <div className="sticky bottom-4 mt-6 bg-white border border-surface-200 rounded-2xl px-5 py-3 shadow-elevated flex items-center justify-between gap-4">
          <div className="text-sm text-surface-600">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </div>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save services"}
          </Button>
        </div>
      )}
    </>
  );
}
