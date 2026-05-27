"use client";

import * as React from "react";
import { Clock } from "lucide-react";

interface OrderCountdownProps {
  /** Customer-facing pickup time: "ASAP" or "HH:MM AM/PM" (or any string we don't know how to parse). */
  pickupTime: string;
  createdAtMs: number;
  /** Order status — affects messaging. */
  status: string;
}

/**
 * Best-effort live countdown to pickup. Parses order.pickupTime back into a
 * Date when possible, falls back to "any minute now" framing for unparseable
 * values. Re-renders every 30s.
 */
export function OrderCountdown({ pickupTime, createdAtMs, status }: OrderCountdownProps) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (status === "completed" || status === "cancelled" || status === "refunded") return null;

  if (status === "ready") {
    return (
      <div className="mt-6 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-5 py-4 flex items-center gap-3">
        <Clock className="h-5 w-5 text-emerald-700" />
        <div>
          <div className="font-medium text-emerald-900">Ready for pickup now!</div>
          <div className="text-sm text-emerald-800">
            Head on over whenever you&apos;re ready.
          </div>
        </div>
      </div>
    );
  }

  const targetMs = parsePickupTarget(pickupTime, createdAtMs);
  if (!targetMs) return null;

  const diffMin = Math.round((targetMs - now) / 60_000);
  const label = formatRemaining(diffMin);

  return (
    <div className="mt-6 rounded-2xl bg-brand/5 ring-1 ring-brand/20 px-5 py-4 flex items-center gap-3">
      <Clock className="h-5 w-5 text-brand" />
      <div>
        <div className="font-medium text-surface-900">{label}</div>
        <div className="text-sm text-surface-600">
          We&apos;ll text and update this page when it&apos;s ready.
        </div>
      </div>
    </div>
  );
}

function formatRemaining(min: number): string {
  if (min <= 0) return "Ready any minute now…";
  if (min === 1) return "Ready in ~1 min";
  if (min < 60) return `Ready in ~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `Ready in ~${h} hr`;
  return `Ready in ~${h} hr ${m} min`;
}

// Parses "ASAP" → ~15 min after order creation.
// Parses "H:MM AM/PM" → today's clock time (or tomorrow if it would be in the past).
// Returns null when we can't make sense of the input.
function parsePickupTarget(pickupTime: string, createdAtMs: number): number | null {
  const trimmed = pickupTime.trim().toUpperCase();
  if (trimmed === "ASAP" || trimmed === "ASAP (~15 MIN)") {
    return createdAtMs + 15 * 60_000;
  }
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(trimmed);
  if (!m) return null;
  let h = Number(m[1]);
  const mins = Number(m[2]);
  const ampm = m[3];
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const created = new Date(createdAtMs);
  const target = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
    h,
    mins,
    0,
    0
  );
  if (target.getTime() < createdAtMs - 60_000) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}
