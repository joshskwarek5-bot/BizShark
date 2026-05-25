"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Triggers router.refresh() at a regular interval while the page is visible.
 * Re-renders any server components without a full page reload.
 */
export function PollRefresh({ intervalMs = 8000 }: { intervalMs?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      id = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    if (document.visibilityState === "visible") start();
    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, intervalMs]);
  return null;
}
