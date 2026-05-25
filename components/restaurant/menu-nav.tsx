"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MenuNavProps {
  categories: { id: string; name: string }[];
}

export function MenuNav({ categories }: MenuNavProps) {
  const [active, setActive] = React.useState<string | null>(categories[0]?.id ?? null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const triggeredScroll = React.useRef(0);

  React.useEffect(() => {
    const observers: IntersectionObserver[] = [];
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (!el) return;
      const ob = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && Date.now() > triggeredScroll.current + 600) {
              setActive(c.id);
            }
          });
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.3, 0.7] }
      );
      ob.observe(el);
      observers.push(ob);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [categories]);

  React.useEffect(() => {
    if (!active || !scrollerRef.current) return;
    const btn = scrollerRef.current.querySelector<HTMLButtonElement>(
      `[data-cat="${active}"]`
    );
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [active]);

  function jump(id: string) {
    triggeredScroll.current = Date.now();
    setActive(id);
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    const offset = 130;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-surface-200 bg-surface-50/90 backdrop-blur-xl">
      <div
        ref={scrollerRef}
        className="flex gap-1.5 overflow-x-auto px-4 sm:px-6 lg:px-8 py-3 no-scrollbar"
      >
        {categories.map((c) => (
          <button
            key={c.id}
            data-cat={c.id}
            onClick={() => jump(c.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition whitespace-nowrap",
              active === c.id
                ? "bg-surface-900 text-white"
                : "text-surface-600 hover:bg-surface-100 hover:text-surface-900"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
