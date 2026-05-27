"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  ClipboardList,
  Settings,
  ExternalLink,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Sparkles,
  LayoutDashboard,
  Receipt,
  Inbox,
  Users,
  CalendarClock,
  Image as ImageIcon,
  CalendarCheck,
} from "lucide-react";
import { parseAppointmentConfig } from "@/lib/availability";
import { cn } from "@/lib/utils";
import { clientTypeMetaFor, type ClientType } from "@/lib/client-type";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";
import { hasFeature } from "@/lib/features";

export interface AdminShellProps {
  slug: string;
  restaurantName: string;
  clientType: ClientType;
  enabledFeatures: string | null;
  appointmentConfig: string | null;
  userName: string;
  userEmail: string;
  isSuper: boolean;
  newOrderCount: number;
  hasBilling: boolean;
  unpaidInvoiceCount: number;
  newInquiryCount: number;
  pendingAppointmentCount: number;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

export function AdminShell({
  slug,
  restaurantName,
  clientType,
  enabledFeatures,
  appointmentConfig,
  userName,
  userEmail,
  isSuper,
  newOrderCount,
  hasBilling,
  unpaidInvoiceCount,
  newInquiryCount,
  pendingAppointmentCount,
  onLogout,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const meta = clientTypeMetaFor(clientType, enabledFeatures);
  const type: BusinessType = (BUSINESS_TYPES as readonly string[]).includes(clientType)
    ? (clientType as BusinessType)
    : "restaurant";
  const hasInquiryFeature =
    hasFeature(type, enabledFeatures, "quote_request") ||
    hasFeature(type, enabledFeatures, "appointment_request") ||
    hasFeature(type, enabledFeatures, "contact_form");
  const hasGalleryFeature = hasFeature(type, enabledFeatures, "gallery");
  // Team tab is shown for business types where staff drives conversion
  const showTeamTab = (
    [
      "personal_service",
      "healthcare",
      "fitness",
      "professional_service",
    ] as BusinessType[]
  ).includes(type);
  // Classes tab is fitness-only
  const showClassesTab = type === "fitness";
  // Booking tabs (Appointments inbox + booking config) shown for any type
  // that allows appointment_request — operator can also use them for the
  // free-form inquiry inbox without enabling slot booking.
  const showBookingTabs = hasFeature(type, enabledFeatures, "appointment_request");
  const bookingEnabled = parseAppointmentConfig(appointmentConfig).enabled;

  type NavItem = {
    href: string;
    label: string;
    icon: typeof ClipboardList;
    exact: boolean;
    badge: number | null;
  };

  const baseNav: NavItem[] = meta.hasMenu
    ? [
        {
          href: `/r/${slug}/admin`,
          label: "Orders",
          icon: ClipboardList,
          exact: true,
          badge: newOrderCount > 0 ? newOrderCount : null,
        },
        { href: `/r/${slug}/admin/menu`, label: "Menu", icon: ChefHat, exact: false, badge: null },
        { href: `/r/${slug}/admin/settings`, label: "Settings", icon: Settings, exact: false, badge: null },
      ]
    : [
        {
          href: `/r/${slug}/admin`,
          label: "Overview",
          icon: LayoutDashboard,
          exact: true,
          badge: null,
        },
        { href: `/r/${slug}/admin/services`, label: "Services", icon: Sparkles, exact: false, badge: null },
        { href: `/r/${slug}/admin/settings`, label: "Settings", icon: Settings, exact: false, badge: null },
      ];

  const nav: NavItem[] = [
    ...baseNav,
    ...(showTeamTab
      ? [
          {
            href: `/r/${slug}/admin/team`,
            label: "Team",
            icon: Users,
            exact: false,
            badge: null,
          } as NavItem,
        ]
      : []),
    ...(showClassesTab
      ? [
          {
            href: `/r/${slug}/admin/classes`,
            label: "Classes",
            icon: CalendarClock,
            exact: false,
            badge: null,
          } as NavItem,
        ]
      : []),
    ...(showBookingTabs
      ? [
          {
            href: `/r/${slug}/admin/appointments`,
            label: "Appointments",
            icon: CalendarCheck,
            exact: false,
            badge: pendingAppointmentCount > 0 ? pendingAppointmentCount : null,
          } as NavItem,
          {
            href: `/r/${slug}/admin/booking`,
            label: bookingEnabled ? "Booking ✓" : "Booking",
            icon: Settings,
            exact: false,
            badge: null,
          } as NavItem,
        ]
      : []),
    ...(hasGalleryFeature
      ? [
          {
            href: `/r/${slug}/admin/gallery`,
            label: "Gallery",
            icon: ImageIcon,
            exact: false,
            badge: null,
          } as NavItem,
        ]
      : []),
    ...(hasInquiryFeature
      ? [
          {
            href: `/r/${slug}/admin/inquiries`,
            label: "Inquiries",
            icon: Inbox,
            exact: false,
            badge: newInquiryCount > 0 ? newInquiryCount : null,
          } as NavItem,
        ]
      : []),
    ...(hasBilling
      ? [
          {
            href: `/r/${slug}/admin/billing`,
            label: "Billing",
            icon: Receipt,
            exact: false,
            badge: unpaidInvoiceCount > 0 ? unpaidInvoiceCount : null,
          } as NavItem,
        ]
      : []),
  ];

  React.useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-surface-50">
      {isSuper && (
        <div className="bg-surface-900 text-white text-xs">
          <div className="mx-auto max-w-7xl px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              You&apos;re viewing as a platform super-admin for {restaurantName}.
            </div>
            <Link href="/platform" className="underline hover:no-underline">
              ← Back to platform
            </Link>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[256px_1fr]">
        <aside
          className={cn(
            "lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-surface-200 bg-white",
            "lg:flex lg:flex-col"
          )}
        >
          <div className="flex items-center justify-between px-5 h-16 border-b border-surface-200">
            <Link href={`/r/${slug}/admin`} className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 grid place-items-center rounded-lg bg-brand text-brand-fg font-display text-sm">
                {restaurantName[0]}
              </div>
              <div className="font-display text-base text-surface-900 truncate">
                {restaurantName}
              </div>
            </Link>
            <button
              className="lg:hidden p-2 -mr-2 text-surface-600"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <nav
            className={cn(
              "px-3 py-4 grid gap-1",
              !mobileOpen && "hidden lg:grid"
            )}
          >
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
                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-surface-100 text-surface-900"
                      : "text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4", active ? "text-brand" : "text-surface-400")} />
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-fg">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <div className="my-2 border-t border-surface-100" />
            <Link
              href={`/r/${slug}`}
              target="_blank"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50 hover:text-surface-900"
            >
              <ExternalLink className="h-4 w-4 text-surface-400" />
              View public site
            </Link>
          </nav>

          <div
            className={cn(
              "mt-auto px-3 pb-4 border-t border-surface-100 pt-4",
              !mobileOpen && "hidden lg:block"
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
          {hasInquiryFeature &&
            newInquiryCount > 0 &&
            !pathname.startsWith(`/r/${slug}/admin/inquiries`) && (
              <NewInquiryBanner slug={slug} count={newInquiryCount} />
            )}
          {hasBilling &&
            unpaidInvoiceCount > 0 &&
            !pathname.startsWith(`/r/${slug}/admin/billing`) && (
              <UnpaidInvoiceBanner slug={slug} count={unpaidInvoiceCount} />
            )}
          {children}
        </main>
      </div>
    </div>
  );
}

function NewInquiryBanner({ slug, count }: { slug: string; count: number }) {
  return (
    <Link
      href={`/r/${slug}/admin/inquiries`}
      className="block bg-gradient-to-r from-sky-600 to-sky-500 text-white px-4 sm:px-6 lg:px-10 py-3 hover:brightness-105 transition"
    >
      <div className="flex items-center gap-3 text-sm">
        <Inbox className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          <strong>{count}</strong> new inquir{count === 1 ? "y" : "ies"} from your
          website — click to respond
        </span>
        <span className="text-xs opacity-80">Open inbox →</span>
      </div>
    </Link>
  );
}

function UnpaidInvoiceBanner({ slug, count }: { slug: string; count: number }) {
  return (
    <Link
      href={`/r/${slug}/admin/billing`}
      className="block bg-gradient-to-r from-brand to-brand/90 text-brand-fg px-4 sm:px-6 lg:px-10 py-3 hover:brightness-105 transition"
    >
      <div className="flex items-center gap-3 text-sm">
        <Receipt className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          <strong>{count}</strong> unpaid invoice{count === 1 ? "" : "s"} —
          click to view &amp; pay
        </span>
        <span className="text-xs opacity-80">View billing →</span>
      </div>
    </Link>
  );
}
