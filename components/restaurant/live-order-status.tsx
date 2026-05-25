"use client";

import * as React from "react";
import { toast } from "sonner";
import { PartyPopper, ChefHat, Check, X } from "lucide-react";
import { LiveConnection } from "./live-connection";
import { statusLabel } from "@/lib/order-status";

interface LiveOrderStatusProps {
  slug: string;
  orderId: string;
  initialStatus: string;
  className?: string;
}

/**
 * Customer-facing live status connection. Shows a celebratory toast when the
 * kitchen advances the status, and the loudest one when the order is ready.
 */
export function LiveOrderStatus({
  slug,
  orderId,
  initialStatus,
  className,
}: LiveOrderStatusProps) {
  const lastStatusRef = React.useRef<string>(initialStatus);

  const handle = React.useCallback((event: string, data: unknown) => {
    if (event !== "order:update") return;
    const evt = data as { status?: string };
    if (!evt?.status) return;
    if (evt.status === lastStatusRef.current) return;
    const prev = lastStatusRef.current;
    lastStatusRef.current = evt.status;

    // Don't toast on initial reconnects (server replays last status)
    if (prev === evt.status) return;

    const messages: Record<string, { title: string; desc?: string; icon: React.ReactNode }> = {
      preparing: {
        title: "Your order is being prepared",
        desc: "We're firing it up now.",
        icon: <ChefHat className="h-4 w-4" />,
      },
      ready: {
        title: "Your order is ready for pickup!",
        desc: "Head on over whenever you're set.",
        icon: <PartyPopper className="h-4 w-4" />,
      },
      completed: {
        title: "Enjoy your meal!",
        desc: "Thanks for ordering.",
        icon: <Check className="h-4 w-4" />,
      },
      cancelled: {
        title: "Your order was cancelled",
        desc: "Please give us a call for details.",
        icon: <X className="h-4 w-4" />,
      },
    };
    const m = messages[evt.status];
    if (!m) return;

    if (evt.status === "ready") {
      toast.success(m.title, {
        description: m.desc,
        duration: 12000,
        icon: m.icon,
      });
      try {
        playReadyChime();
      } catch {}
    } else if (evt.status === "cancelled") {
      toast.error(m.title, { description: m.desc, icon: m.icon, duration: 10000 });
    } else {
      toast(m.title, { description: m.desc, icon: m.icon });
    }
  }, []);

  return (
    <LiveConnection
      url={`/api/r/${slug}/order/${orderId}/stream`}
      onEvent={handle}
      refreshOnEvent
      className={className}
      label={statusLabel(initialStatus)}
    />
  );
}

let audioCtx: AudioContext | null = null;

function playReadyChime() {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  const ctx = audioCtx;
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const tone = (freq: number, start: number, dur: number, gainPeak = 0.2) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };
  // Cheerful arpeggio
  tone(523.25, 0, 0.18); // C5
  tone(659.25, 0.14, 0.18); // E5
  tone(783.99, 0.28, 0.28); // G5
}
