"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type LiveEventHandler = (event: string, data: unknown) => void;

interface LiveConnectionProps {
  /** Absolute path to the SSE endpoint. */
  url: string;
  /** Called for every event received (including `connected`). */
  onEvent?: LiveEventHandler;
  /** If true, calls router.refresh() on every event (except connected/heartbeat). */
  refreshOnEvent?: boolean;
  /** Optional CSS class for the status indicator wrapper. */
  className?: string;
  /** If true, show a tiny floating indicator. Default false (silent). */
  showIndicator?: boolean;
  /** Label shown next to the dot when expanded. Default "Live". */
  label?: string;
}

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "closed";

/**
 * Subscribes to an SSE endpoint and (optionally) refreshes the current route's
 * server components on every event. EventSource auto-reconnects with exponential
 * backoff, and we pause the connection when the tab is hidden to save resources.
 */
export function LiveConnection({
  url,
  onEvent,
  refreshOnEvent = true,
  className,
  showIndicator = true,
  label = "Live",
}: LiveConnectionProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ConnectionStatus>("connecting");
  const onEventRef = React.useRef(onEvent);
  React.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  React.useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;

    const open = () => {
      if (stopped) return;
      setStatus(es === null ? "connecting" : "reconnecting");
      es = new EventSource(url, { withCredentials: false });

      es.addEventListener("open", () => {
        setStatus("connected");
      });

      // The server emits named events; without a listener they aren't dispatched
      // through onmessage, so we register catch-alls for the common ones.
      const dispatch = (name: string) => (evt: MessageEvent) => {
        let data: unknown = evt.data;
        try {
          data = JSON.parse(evt.data);
        } catch {}
        onEventRef.current?.(name, data);
        if (refreshOnEvent && name !== "connected") {
          router.refresh();
        }
      };

      es.addEventListener("connected", dispatch("connected"));
      es.addEventListener("order:new", dispatch("order:new"));
      es.addEventListener("order:update", dispatch("order:update"));
      es.addEventListener("message", dispatch("message"));

      es.addEventListener("error", () => {
        // Browser EventSource auto-reconnects; surface state for UX.
        if (es?.readyState === EventSource.CLOSED) {
          setStatus("closed");
          // Try to reopen manually after a delay if it gave up
          setTimeout(open, 4000);
        } else {
          setStatus("reconnecting");
        }
      });
    };

    const close = () => {
      if (es) {
        es.close();
        es = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!es || es.readyState === EventSource.CLOSED) open();
      } else {
        close();
        setStatus("closed");
      }
    };

    if (document.visibilityState === "visible") open();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [url, router, refreshOnEvent]);

  if (!showIndicator) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition",
        status === "connected" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
        status === "connecting" && "bg-surface-100 text-surface-600 ring-surface-200",
        status === "reconnecting" && "bg-amber-50 text-amber-700 ring-amber-200",
        status === "closed" && "bg-surface-100 text-surface-500 ring-surface-200",
        className
      )}
      aria-live="polite"
    >
      {status === "closed" ? (
        <WifiOff className="h-3 w-3" />
      ) : (
        <Wifi className="h-3 w-3" />
      )}
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          status === "connected" && "bg-emerald-500 animate-pulse",
          status === "connecting" && "bg-surface-400",
          status === "reconnecting" && "bg-amber-500 animate-pulse",
          status === "closed" && "bg-surface-400"
        )}
      />
      {status === "connected"
        ? label
        : status === "reconnecting"
          ? "Reconnecting…"
          : status === "closed"
            ? "Offline"
            : "Connecting…"}
    </div>
  );
}
