"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  LogOut,
  Plus,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformShellProps {
  userName: string;
  userEmail: string;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

export function PlatformShell({
  userName,
  userEmail,
  onLogout,
  children,
}: PlatformShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const nav = [
    { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/platform/restaurants", label: "Restaurants", icon: Store },
  ];

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="lg:grid lg:grid-cols-[256px_1fr]">
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-surface-200 bg-surface-900 text-white lg:flex lg:flex-col">
          <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
            <Link href="/platform" className="flex items-center gap-2">
              <div className="h-8 w-8 grid place-items-center rounded-lg bg-white text-surface-900">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-base">Platform</div>
                <div className="text-[10px] uppercase tracking-widest text-white/50">
                  Agency console
                </div>
              </div>
            </Link>
            <button
              className="lg:hidden p-2 -mr-2 text-white/70"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <nav className={cn("px-3 py-4 grid gap-1", !open && "hidden lg:grid")}>
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/65 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-white" : "text-white/50"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
            <div className="my-2 border-t border-white/10" />
            <Link
              href="/platform/restaurants/new"
              className="flex items-center gap-3 rounded-xl bg-brand text-brand-fg px-3 py-2.5 text-sm font-medium hover:brightness-105 transition"
            >
              <Plus className="h-4 w-4" />
              New restaurant
            </Link>
          </nav>

          <div
            className={cn(
              "mt-auto px-3 pb-4 border-t border-white/10 pt-4",
              !open && "hidden lg:block"
            )}
          >
            <div className="px-3 pb-3">
              <div className="text-sm font-medium text-white truncate">{userName || userEmail}</div>
              <div className="text-xs text-white/50 truncate">{userEmail}</div>
            </div>
            <form action={onLogout}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-4 w-4 text-white/50" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
