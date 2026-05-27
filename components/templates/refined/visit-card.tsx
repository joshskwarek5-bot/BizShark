import Link from "next/link";
import { MapPin, Phone, Mail, Clock, ArrowUpRight } from "lucide-react";
import { type Restaurant } from "@prisma/client";
import {
  parseHours,
  DAYS,
  formatDayHours,
  getCurrentDayKey,
  openStatus,
} from "@/lib/hours";

export function RefinedVisitCard({ restaurant }: { restaurant: Restaurant }) {
  const hours = parseHours(restaurant.hours);
  const today = getCurrentDayKey();
  const status = openStatus(hours);
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(
    `${restaurant.name} ${restaurant.address} ${restaurant.city ?? ""} ${restaurant.state ?? ""}`
  )}`;

  return (
    <section
      id="visit"
      className="bg-[#FAF8F4] py-24 md:py-32 border-t border-surface-900/15"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-10">
        <div className="text-center mb-16">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--brand)]">
            Visit
          </div>
          <div className="mt-6 mx-auto h-px w-12 bg-surface-900/30" />
          <h2 className="mt-6 font-display text-4xl md:text-5xl text-surface-900 tracking-tight">
            We&apos;d love to see you
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div className="space-y-6">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="group block"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-surface-500">
                Address
              </div>
              <div className="mt-2 font-display text-2xl text-surface-900">
                {restaurant.address}
              </div>
              {restaurant.city && (
                <div className="text-surface-600 mt-1">
                  {restaurant.city}
                  {restaurant.state ? `, ${restaurant.state}` : ""}
                  {restaurant.zip ? ` ${restaurant.zip}` : ""}
                </div>
              )}
              <div className="mt-2 text-[11px] font-medium inline-flex items-center gap-1 text-[var(--brand)] opacity-0 group-hover:opacity-100 transition">
                Get directions <ArrowUpRight className="h-3 w-3" />
              </div>
            </a>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-surface-500">
                Phone
              </div>
              <a
                href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`}
                className="block mt-2 font-display text-2xl text-surface-900 hover:text-[var(--brand)] transition"
              >
                {restaurant.phone}
              </a>
            </div>

            {restaurant.email && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-surface-500">
                  Email
                </div>
                <a
                  href={`mailto:${restaurant.email}`}
                  className="block mt-2 font-display text-2xl text-surface-900 hover:text-[var(--brand)] transition"
                >
                  {restaurant.email}
                </a>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-6">
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-surface-500">
                Hours
              </div>
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                <Clock className="h-3 w-3 text-[var(--brand)]" />
                <span
                  className={
                    status.open ? "text-emerald-700" : "text-amber-700"
                  }
                >
                  {status.label}
                </span>
              </div>
            </div>
            <dl className="border-t border-surface-900/15">
              {DAYS.map((d) => (
                <div
                  key={d.key}
                  className={`flex items-baseline justify-between py-3 border-b border-surface-900/10 text-sm ${
                    d.key === today ? "text-surface-900 font-semibold" : "text-surface-700"
                  }`}
                >
                  <dt>{d.label}</dt>
                  <dd className="tabular-nums">{formatDayHours(hours[d.key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
