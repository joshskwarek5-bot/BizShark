"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pause, Play, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DAYS, parseHours, type Hours } from "@/lib/hours";
import {
  setOrderingPaused,
  setOrderingHours,
} from "@/app/r/[slug]/admin/(panel)/actions";

interface OrderingControlsProps {
  slug: string;
  isOrderingPaused: boolean;
  orderingHours: string | null;
  /** Physical hours, used as the default seed when enabling separate hours. */
  hours: string;
}

export function OrderingControls({
  slug,
  isOrderingPaused,
  orderingHours,
  hours,
}: OrderingControlsProps) {
  const router = useRouter();
  const [paused, setPaused] = React.useState(isOrderingPaused);
  const [useSeparateHours, setUseSeparateHours] = React.useState(orderingHours !== null);
  const [draftHours, setDraftHours] = React.useState<Hours>(() =>
    parseHours(orderingHours ?? hours)
  );
  const [savingPause, setSavingPause] = React.useState(false);
  const [savingHours, setSavingHours] = React.useState(false);

  async function onTogglePause(next: boolean) {
    setPaused(next);
    setSavingPause(true);
    try {
      const res = await setOrderingPaused({ slug, paused: next });
      if (res.ok) {
        toast.success(next ? "Online ordering paused" : "Online ordering resumed");
        router.refresh();
      } else {
        setPaused(!next);
      }
    } catch {
      setPaused(!next);
      toast.error("Could not update");
    } finally {
      setSavingPause(false);
    }
  }

  async function onSaveHours() {
    setSavingHours(true);
    try {
      const payload = useSeparateHours ? JSON.stringify(draftHours) : null;
      const res = await setOrderingHours({ slug, hoursJson: payload });
      if (res.ok) {
        toast.success(
          useSeparateHours ? "Online ordering hours saved" : "Online ordering follows main hours"
        );
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not save");
      }
    } catch {
      toast.error("Could not save");
    } finally {
      setSavingHours(false);
    }
  }

  function setDayField<K extends keyof Hours["mon"]>(
    day: keyof Hours,
    field: K,
    value: Hours["mon"][K]
  ) {
    setDraftHours((h) => ({ ...h, [day]: { ...h[day], [field]: value } }));
  }

  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
        <Clock className="h-4 w-4 text-brand" />
        <span className="uppercase tracking-wider text-xs">Online ordering</span>
      </div>

      {/* PAUSE TOGGLE */}
      <div
        className={`rounded-2xl border p-5 transition ${
          paused ? "border-amber-200 bg-amber-50" : "border-surface-200 bg-surface-50"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-medium text-surface-900">
              {paused ? (
                <Pause className="h-4 w-4 text-amber-700" />
              ) : (
                <Play className="h-4 w-4 text-emerald-600" />
              )}
              {paused ? "Online ordering is paused" : "Accepting online orders"}
            </div>
            <p className="text-sm text-surface-600 mt-1">
              {paused
                ? "Customers see a banner and can't submit orders. They can still call."
                : "Customers can place pickup orders during your ordering hours."}
            </p>
          </div>
          <Switch
            checked={!paused}
            onCheckedChange={(open) => onTogglePause(!open)}
            disabled={savingPause}
            aria-label="Accept online orders"
          />
        </div>
      </div>

      {/* SEPARATE HOURS */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-surface-900">Different hours for ordering</div>
            <p className="text-sm text-surface-600 mt-1">
              Off: ordering follows your main open hours.
              <br />
              On: set custom windows (useful for stopping orders 30min before close).
            </p>
          </div>
          <Switch
            checked={useSeparateHours}
            onCheckedChange={setUseSeparateHours}
            aria-label="Use separate ordering hours"
          />
        </div>

        {useSeparateHours && (
          <div className="divide-y divide-surface-100 rounded-2xl border border-surface-200 bg-white overflow-hidden">
            {DAYS.map((d) => {
              const day = draftHours[d.key];
              return (
                <div
                  key={d.key}
                  className="grid grid-cols-[90px_1fr] sm:grid-cols-[110px_auto_1fr_1fr] items-center gap-3 px-4 py-3"
                >
                  <div className="font-medium text-surface-800">{d.label}</div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span className="text-xs text-surface-500">
                      {day.closed ? "Closed" : "Open"}
                    </span>
                    <Switch
                      checked={!day.closed}
                      onCheckedChange={(open) => setDayField(d.key, "closed", !open)}
                    />
                  </div>
                  <Input
                    type="time"
                    value={day.open}
                    onChange={(e) => setDayField(d.key, "open", e.target.value)}
                    disabled={day.closed}
                    className="h-9"
                  />
                  <Input
                    type="time"
                    value={day.close}
                    onChange={(e) => setDayField(d.key, "close", e.target.value)}
                    disabled={day.closed}
                    className="h-9"
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onSaveHours} disabled={savingHours} size="sm">
            {savingHours && <Loader2 className="h-4 w-4 animate-spin" />}
            Save ordering hours
          </Button>
        </div>
      </div>
    </section>
  );
}
