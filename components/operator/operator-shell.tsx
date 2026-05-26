"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Search,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OperatorShellProps {
  operatorName: string;
  businessName: string | null;
  userName: string;
  userEmail: string;
  /** Optional banner shown above the main content (e.g. trial / past-due notice). */
  topBanner?: React.ReactNode;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

export function OperatorShell({
  operatorName,
  businessName,
  userName,
  userEmail,
  topBanner,
  onLogout,
  children,
}: OperatorShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const nav = [
    { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/app/leads", label: "Leads", icon: Search },
    { href: "/app/clients", label: "Clients", icon: Users },
    { href: "/app/templates", label: "Templates", icon: FileText },
    { href: "/app/billing", label: "Billing", icon: CreditCard },
    { href: "/app/settings", label: "Settings", icon: Settings },
  ];

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-surface-200 bg-white lg:flex lg:flex-col">
          <div className="flex items-center justify-between px-5 h-16 border-b border-surface-200">
            <Link href="/app" className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 grid place-items-center rounded-lg bg-brand text-brand-fg">
                <Rocket className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-base text-surface-900 truncate">
                  {businessName ?? operatorName}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-surface-500">
                  Operator
                </div>
              </div>
            </Link>
            <button
              className="lg:hidden p-2 -mr-2 text-surface-600"
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
                      ? "bg-surface-100 text-surface-900"
                      : "text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-brand" : "text-surface-400")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className={cn(
              "mt-auto px-3 pb-4 border-t border-surface-100 pt-4",
              !open && "hidden lg:block"
            )}
          >
            <div className="px-3 pb-3">
              <div className="text-sm font-medium text-surface-900 truncate">{userName || userEmail}</div>
              <div className="text-xs text-surface-500 truncate">{userEmail}</div>
            </div>
            <form action={onLogout}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50 hover:text-surface-900"
              >
                <LogOut className="h-4 w-4 text-surface-400" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0">
          {topBanner}
          {children}
        </main>
      </div>
    </div>
  );
}
