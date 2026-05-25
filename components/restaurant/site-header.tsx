"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartIconButton } from "./cart-icon-button";

interface SiteHeaderProps {
  slug: string;
  name: string;
  /** True if this client has an online menu/ordering (i.e. type === "restaurant"). */
  showMenu?: boolean;
  /** Phone number for the "Call" CTA on service-business sites. */
  phone?: string;
  primaryCtaLabel?: string;
}

export function SiteHeader({
  slug,
  name,
  showMenu = true,
  phone,
  primaryCtaLabel = "Order online",
}: SiteHeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = [
    { href: `/r/${slug}`, label: "Home" },
    ...(showMenu ? [{ href: `/r/${slug}/menu`, label: "Menu" }] : [{ href: `/r/${slug}#services`, label: "Services" }]),
    { href: `/r/${slug}#hours`, label: "Hours" },
    { href: `/r/${slug}#visit`, label: "Visit" },
  ];

  const primaryHref = showMenu ? `/r/${slug}/menu` : phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : `/r/${slug}#visit`;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        scrolled
          ? "border-b border-surface-200/70 bg-surface-50/85 backdrop-blur-xl shadow-soft"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/r/${slug}`} className="font-display text-xl font-medium text-surface-900">
          {name}
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active =
              l.href === `/r/${slug}`
                ? pathname === l.href
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active
                    ? "text-surface-900"
                    : "text-surface-600 hover:text-surface-900"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={primaryHref}
            className="hidden sm:inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-soft hover:shadow-elevated transition active:scale-[0.98]"
          >
            {primaryCtaLabel}
          </Link>
          {showMenu && <CartIconButton slug={slug} />}
          <button
            type="button"
            aria-label="Menu"
            className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-surface-800 shadow-crisp"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-surface-200 bg-surface-50/95 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-4 grid gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-4 py-3 text-sm font-medium text-surface-700 hover:bg-surface-100"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={primaryHref}
              className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-brand-fg shadow-soft"
            >
              {primaryCtaLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
