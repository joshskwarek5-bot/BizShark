import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { type Restaurant } from "@prisma/client";
import { parseHours, DAYS, formatDayHours } from "@/lib/hours";

export function SiteFooter({ restaurant }: { restaurant: Restaurant }) {
  const hours = parseHours(restaurant.hours);
  return (
    <footer className="mt-24 border-t border-surface-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <div className="font-display text-2xl text-surface-900">{restaurant.name}</div>
          {restaurant.tagline && (
            <p className="mt-2 text-sm text-surface-600 leading-relaxed">{restaurant.tagline}</p>
          )}
          <div className="mt-6 space-y-2 text-sm text-surface-700">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(
                `${restaurant.name} ${restaurant.address} ${restaurant.city ?? ""} ${restaurant.state ?? ""}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-3 hover:text-brand"
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-brand" />
              <span>
                {restaurant.address}
                {restaurant.city && (
                  <>
                    <br />
                    {restaurant.city}, {restaurant.state} {restaurant.zip}
                  </>
                )}
              </span>
            </a>
            <a
              href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-3 hover:text-brand"
            >
              <Phone className="h-4 w-4 text-brand" /> {restaurant.phone}
            </a>
            {restaurant.email && (
              <a
                href={`mailto:${restaurant.email}`}
                className="flex items-center gap-3 hover:text-brand"
              >
                <Mail className="h-4 w-4 text-brand" /> {restaurant.email}
              </a>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-surface-900">
            <Clock className="h-4 w-4 text-brand" /> Hours
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            {DAYS.map((d) => (
              <div key={d.key} className="flex justify-between gap-4 text-surface-700">
                <dt>{d.label}</dt>
                <dd className="text-surface-900 font-medium">{formatDayHours(hours[d.key])}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <div className="text-sm font-medium text-surface-900">Visit</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href={`/r/${restaurant.slug}/menu`} className="text-surface-700 hover:text-brand">
                Browse the menu
              </Link>
            </li>
            <li>
              <Link href={`/r/${restaurant.slug}/menu`} className="text-surface-700 hover:text-brand">
                Order online for pickup
              </Link>
            </li>
            <li>
              <Link
                href={`/r/${restaurant.slug}/admin/login`}
                className="text-surface-500 hover:text-brand"
              >
                Staff login
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-surface-200">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between text-xs text-surface-500">
          <div>© {new Date().getFullYear()} {restaurant.name}. All rights reserved.</div>
          <div>Powered by BizShark</div>
        </div>
      </div>
    </footer>
  );
}
