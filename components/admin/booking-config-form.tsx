"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, Check, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { parseHours, DAYS, formatDayHours, type Hours } from "@/lib/hours";
import type { AppointmentConfig } from "@/lib/availability";
import { updateAppointmentConfig } from "@/app/r/[slug]/admin/(panel)/booking-actions";

interface Props {
  slug: string;
  initial: AppointmentConfig;
  hours: string;
}

const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30];
const LEAD_OPTIONS = [0, 1, 2, 4, 12, 24, 48];

export function BookingConfigForm({ slug, initial, hours: hoursJson }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [slotMinutes, setSlotMinutes] = React.useState(initial.slotMinutes);
  const [bufferMinutes, setBufferMinutes] = React.useState(initial.bufferMinutes);
  const [leadTimeHours, setLeadTimeHours] = React.useState(initial.leadTimeHours);
  const [maxDaysAhead, setMaxDaysAhead] = React.useState(initial.maxDaysAhead);
  const [saving, setSaving] = React.useState(false);

  const hours: Hours = React.useMemo(() => parseHours(hoursJson), [hoursJson]);

  async function onSave() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await updateAppointmentConfig({
        slug,
        enabled,
        slotMinutes,
        bufferMinutes,
        leadTimeHours,
        maxDaysAhead,
      });
      if (res.ok) {
        toast.success("Booking settings saved");
        router.refresh();
      } else {
        toast.error("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-brand mb-2">
          <CalendarClock className="h-3.5 w-3.5" /> Booking
        </div>
        <h1 className="font-display text-4xl text-surface-900">
          Appointment booking
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Let customers book themselves online based on your weekly hours.
        </p>
      </div>

      {/* Master toggle */}
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl text-surface-900">
              Online booking
            </div>
            <p className="text-sm text-surface-600 mt-1">
              When ON, the public site shows a real availability calendar +
              instant-book widget. When OFF, it falls back to the &ldquo;request
              an appointment&rdquo; contact form.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable online booking"
          />
        </div>
      </section>

      {enabled && (
        <>
          {/* Hours summary */}
          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
                <Clock className="h-4 w-4 text-brand" />
                <span className="uppercase tracking-wider text-xs">
                  Weekly hours
                </span>
              </div>
              <Link
                href={`/r/${slug}/admin/settings`}
                className="text-xs text-brand hover:underline inline-flex items-center gap-1"
              >
                <Settings className="h-3 w-3" /> Edit hours in Settings
              </Link>
            </div>
            <p className="text-sm text-surface-600 mb-4">
              Slots are generated from these hours. Customers can only book
              when you&apos;re open.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {DAYS.map((d) => (
                <div
                  key={d.key}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                    hours[d.key].closed
                      ? "bg-surface-50 text-surface-500"
                      : "bg-emerald-50/40 text-surface-700"
                  )}
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="tabular-nums">{formatDayHours(hours[d.key])}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Slot config */}
          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 mb-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
              <Settings className="h-4 w-4 text-brand" />
              <span className="uppercase tracking-wider text-xs">
                Slot configuration
              </span>
            </div>

            <PickRow
              label="Slot length"
              hint="Every X minutes a new slot starts. Pick what matches your services."
              options={SLOT_OPTIONS}
              value={slotMinutes}
              onChange={setSlotMinutes}
              suffix="min"
            />
            <PickRow
              label="Buffer between bookings"
              hint="Wiggle room for cleanup, transitions, or walk-out time."
              options={BUFFER_OPTIONS}
              value={bufferMinutes}
              onChange={setBufferMinutes}
              suffix="min"
            />
            <PickRow
              label="Lead time"
              hint="Earliest a customer can book before the appointment. Prevents last-minute surprises."
              options={LEAD_OPTIONS}
              value={leadTimeHours}
              onChange={setLeadTimeHours}
              suffix="hr"
            />

            <div className="grid gap-1.5">
              <Label htmlFor="bcf-max">Bookable how far ahead?</Label>
              <Input
                id="bcf-max"
                type="number"
                min="1"
                max="365"
                value={maxDaysAhead}
                onChange={(e) =>
                  setMaxDaysAhead(parseInt(e.target.value || "30", 10))
                }
                className="max-w-32"
              />
              <p className="text-[11px] text-surface-500">
                Customers see dates from today up to this many days ahead.
              </p>
            </div>
          </section>
        </>
      )}

      <div className="sticky bottom-4 bg-white border border-surface-200 rounded-2xl px-5 py-3 shadow-elevated flex items-center justify-between gap-4">
        <div className="text-sm text-surface-600">
          {enabled
            ? "Booking widget will appear on your public site."
            : "Booking is OFF — public site shows the contact form instead."}
        </div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save settings
        </Button>
      </div>
    </>
  );
}

function PickRow({
  label,
  hint,
  options,
  value,
  onChange,
  suffix,
}: {
  label: string;
  hint?: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition",
              value === opt
                ? "bg-brand text-brand-fg shadow-soft"
                : "bg-surface-100 text-surface-700 hover:bg-surface-200"
            )}
          >
            {opt} {suffix}
          </button>
        ))}
      </div>
      {hint && <p className="text-[11px] text-surface-500">{hint}</p>}
    </div>
  );
}
