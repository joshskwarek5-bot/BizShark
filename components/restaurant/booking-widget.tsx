"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Loader2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bookAppointment,
  getAvailableSlots,
} from "@/app/r/[slug]/(customer)/booking-actions";

interface PublicService {
  id: string;
  name: string;
  duration: string | null;
  priceCents?: number | null;
}

interface Props {
  slug: string;
  businessName: string;
  services: PublicService[];
  /** Max days the user can browse ahead (mirrors config server-side). */
  maxDaysAhead: number;
}

interface SlotRow {
  time: string;
  startsAtIso: string;
  endsAtIso: string;
}

export function BookingWidget({
  slug,
  businessName,
  services,
  maxDaysAhead,
}: Props) {
  const [serviceId, setServiceId] = React.useState<string>(
    services[0]?.id ?? ""
  );
  const [dateStr, setDateStr] = React.useState<string>(() => isoDate(new Date()));
  const [slots, setSlots] = React.useState<SlotRow[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState<SlotRow | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [booking, setBooking] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState<{
    startsAt: string;
  } | null>(null);

  // Today/next-N-days quick picker
  const dates = React.useMemo(() => {
    const out: { iso: string; label: string; sub: string; isToday: boolean }[] = [];
    const today = startOfToday();
    for (let i = 0; i < Math.min(maxDaysAhead, 14); i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      out.push({
        iso: isoDate(d),
        label: d.toLocaleDateString(undefined, {
          weekday: "short",
        }),
        sub: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        isToday: i === 0,
      });
    }
    return out;
  }, [maxDaysAhead]);

  // Fetch slots whenever date/service changes
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const res = await getAvailableSlots({
          slug,
          date: dateStr,
          serviceId: serviceId || undefined,
        });
        if (cancelled) return;
        if (res.ok) {
          setSlots(res.slots);
        } else {
          setSlots([]);
          if (!/Booking is not enabled|Restaurant not found/.test(res.error)) {
            toast.error(res.error);
          }
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, dateStr, serviceId]);

  async function onBook(e: React.FormEvent) {
    e.preventDefault();
    if (booking) return;
    if (!selectedSlot) {
      toast.error("Pick a time slot");
      return;
    }
    if (!name.trim()) {
      toast.error("What's your name?");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("Add an email or phone so we can confirm");
      return;
    }
    setBooking(true);
    try {
      const res = await bookAppointment({
        slug,
        serviceId: serviceId || undefined,
        startsAtIso: selectedSlot.startsAtIso,
        customerName: name.trim(),
        customerEmail: email.trim() || "",
        customerPhone: phone.trim() || "",
        notes: notes.trim() || "",
      });
      if (res.ok) {
        setConfirmed({ startsAt: res.startsAt });
        toast.success("Booked — see you then.");
      } else {
        toast.error(res.error);
        // Refresh slots in case it was the "slot taken" race condition
        if (/slot was just taken/i.test(res.error)) {
          const refresh = await getAvailableSlots({
            slug,
            date: dateStr,
            serviceId: serviceId || undefined,
          });
          if (refresh.ok) setSlots(refresh.slots);
        }
      }
    } finally {
      setBooking(false);
    }
  }

  if (confirmed) {
    const when = new Date(confirmed.startsAt).toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <section
        id="appointment"
        className="bg-white py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
      >
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-3xl text-surface-900">
            You&apos;re booked!
          </h2>
          <p className="mt-2 text-surface-600">
            <strong>{when}</strong> with {businessName}.
          </p>
          <p className="mt-2 text-sm text-surface-500">
            We&apos;ll send a confirmation to your{" "}
            {email ? "email" : "phone"} shortly. Need to make a change? Reply
            to that message or give us a call.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="appointment"
      className="bg-white py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-fg">
            <CalendarClock className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-4xl text-surface-900">
            Book an appointment
          </h2>
          <p className="mt-2 text-surface-600">
            Pick a service, then a time. Confirmed by phone or email.
          </p>
        </div>

        <form onSubmit={onBook} className="grid gap-6">
          {/* Service picker */}
          {services.length > 0 ? (
            <div className="grid gap-2">
              <Label>Service</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {services.slice(0, 8).map((s) => {
                  const active = serviceId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      className={cn(
                        "text-left rounded-2xl border-2 p-3 transition",
                        active
                          ? "border-brand bg-brand/5"
                          : "border-surface-200 bg-white hover:border-surface-300"
                      )}
                    >
                      <div className="font-medium text-surface-900 text-sm">
                        {s.name}
                      </div>
                      <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-2">
                        {s.duration && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {s.duration}
                          </span>
                        )}
                        {s.priceCents != null && s.priceCents > 0 && (
                          <span>${(s.priceCents / 100).toFixed(0)}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Date picker */}
          <div className="grid gap-2">
            <Label>Date</Label>
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {dates.map((d) => {
                const active = dateStr === d.iso;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setDateStr(d.iso)}
                    className={cn(
                      "snap-start shrink-0 w-16 h-20 rounded-2xl border-2 grid place-items-center transition",
                      active
                        ? "border-brand bg-brand text-brand-fg"
                        : "border-surface-200 bg-white text-surface-900 hover:border-surface-300"
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-wider font-medium opacity-70">
                      {d.label}
                    </div>
                    <div className="font-display text-lg tabular-nums">
                      {d.sub.split(" ")[1]}
                    </div>
                    <div className="text-[10px] opacity-60">
                      {d.isToday ? "today" : d.sub.split(" ")[0]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot picker */}
          <div className="grid gap-2">
            <Label>
              Available times{" "}
              {!loadingSlots && (
                <span className="text-xs font-normal text-surface-500">
                  ({slots.length})
                </span>
              )}
            </Label>
            {loadingSlots ? (
              <div className="rounded-2xl bg-surface-50 ring-1 ring-surface-200 p-6 text-center text-sm text-surface-500 inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl bg-surface-50 ring-1 ring-surface-200 p-6 text-center text-sm text-surface-500">
                No openings that day. Try another date.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                {slots.map((s) => {
                  const active = selectedSlot?.startsAtIso === s.startsAtIso;
                  return (
                    <button
                      key={s.startsAtIso}
                      type="button"
                      onClick={() => setSelectedSlot(s)}
                      className={cn(
                        "rounded-xl border-2 px-3 py-2 text-sm font-medium tabular-nums transition",
                        active
                          ? "border-brand bg-brand text-brand-fg"
                          : "border-surface-200 bg-white text-surface-800 hover:border-surface-300"
                      )}
                    >
                      {formatTime12(s.time)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer info */}
          {selectedSlot && (
            <>
              <div className="rounded-2xl bg-brand/5 ring-1 ring-brand/30 p-4 text-sm">
                <div className="text-xs uppercase tracking-wider text-brand font-medium mb-1">
                  Booking
                </div>
                <div className="font-display text-xl text-surface-900">
                  {new Date(selectedSlot.startsAtIso).toLocaleString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                {services.find((s) => s.id === serviceId) && (
                  <div className="text-xs text-surface-600 mt-1">
                    {services.find((s) => s.id === serviceId)?.name}
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="bk-name">Your name *</Label>
                  <Input
                    id="bk-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bk-phone">Phone</Label>
                  <Input
                    id="bk-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bk-email">Email</Label>
                <Input
                  id="bk-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
                <p className="text-[11px] text-surface-500">
                  Add an email or phone so we can confirm.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bk-notes">Anything to mention?</Label>
                <Textarea
                  id="bk-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Allergies, requests, who you've booked with before…"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={booking}>
                  {booking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Booking…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Confirm appointment
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </section>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, "0")}${period}`;
}

// keep imports for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _used = [ChevronLeft, ChevronRight];
