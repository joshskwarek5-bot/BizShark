"use client";

import * as React from "react";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { LiveConnection } from "@/components/restaurant/live-connection";

interface LiveOrderFeedProps {
  slug: string;
  initialMaxOrderNumber: number;
  className?: string;
}

/**
 * Subscribes to the restaurant's SSE stream. On a NEW order event with an
 * order number we haven't seen before, plays a notification sound and shows
 * a toast. Status updates trigger a silent router.refresh().
 */
export function LiveOrderFeed({
  slug,
  initialMaxOrderNumber,
  className,
}: LiveOrderFeedProps) {
  const seenRef = React.useRef<number>(initialMaxOrderNumber);

  const handle = React.useCallback((event: string, data: unknown) => {
    if (event !== "order:new") return;
    const evt = data as { orderNumber?: number };
    if (!evt?.orderNumber || evt.orderNumber <= seenRef.current) return;
    seenRef.current = evt.orderNumber;

    // Toast
    toast.success(`New order — #${evt.orderNumber}`, {
      description: "Tap to view in the queue",
      duration: 6000,
      icon: <ShoppingBag className="h-4 w-4" />,
    });

    // Optional notification sound — generated, no asset file needed.
    try {
      playDing();
    } catch {
      /* user gesture not yet given; ignore */
    }
  }, []);

  return (
    <LiveConnection
      url={`/api/r/${slug}/admin/stream`}
      onEvent={handle}
      refreshOnEvent
      className={className}
      label="Live orders"
    />
  );
}

let audioCtx: AudioContext | null = null;

/** Quick two-tone ding using Web Audio (no asset). */
function playDing() {
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
  // Some browsers suspend AudioContext until a user gesture; try to resume.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const tone = (freq: number, start: number, dur: number, gainPeak = 0.18) => {
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
  tone(880, 0, 0.18); // A5
  tone(1318.51, 0.13, 0.22); // E6
}
