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

export function BoldVisitCard({ restaurant }: { restaurant: Restaurant }) {
  const hours = parseHours(restaurant.hours);
  const today = getCurrentDayKey();
  const status = openStatus(hours);
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(
    `${restaurant.name} ${restaurant.address} ${restaurant.city ?? ""} ${restaurant.state ?? ""}`
  )}`;

  return (
    <section
      id="visit"
      className="bg-black text-white py-24 md:py-32 border-t border-white/10"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-2 items-start">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--brand)]">
              Find us
            </div>
            <h2 className="mt-4 font-sans font-black uppercase text-5xl md:text-6xl leading-[0.95]">
              Show up.
            </h2>
            <p className="mt-6 text-lg text-white/80 max-w-md leading-relaxed">
              Stop by, ring us, or shoot us an email. Door&apos;s always open
              during business hours.
            </p>

            <div className="mt-10 space-y-5">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-4 hover:text-[var(--brand)] transition"
              >
                <MapPin className="h-5 w-5 mt-0.5 text-[var(--brand)] shrink-0" />
                <div>
                  <div className="font-bold uppercase text-sm tracking-wider">
                    {restaurant.address}
                  </div>
                  {restaurant.city && (
                    <div className="text-white/70 text-sm mt-0.5">
                      {restaurant.city}
                      {restaurant.state ? `, ${restaurant.state}` : ""}
                      {restaurant.zip ? ` ${restaurant.zip}` : ""}
                    </div>
                  )}
                  <div className="text-[10px] uppercase tracking-[0.3em] mt-1 inline-flex items-center gap-1 text-[var(--brand)] opacity-0 group-hover:opacity-100 transition">
                    Get directions <ArrowUpRight className="h-3 w-3" />
                  </div>
                </div>
              </a>
              <a
                href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`}
                className="flex items-center gap-4 hover:text-[var(--brand)] transition"
              >
                <Phone className="h-5 w-5 text-[var(--brand)] shrink-0" />
                <span className="font-bold uppercase text-sm tracking-wider">
                  {restaurant.phone}
                </span>
              </a>
              {restaurant.email && (
                <a
                  href={`mailto:${restaurant.email}`}
                  className="flex items-center gap-4 hover:text-[var(--brand)] transition"
                >
                  <Mail className="h-5 w-5 text-[var(--brand)] shrink-0" />
                  <span className="font-bold uppercase text-sm tracking-wider">
                    {restaurant.email}
                  </span>
                </a>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--brand)]">
                Hours
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3 text-[var(--brand)]" />
                <span
                  className={`uppercase tracking-wider ${
                    status.open ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {status.label}
                </span>
              </div>
            </div>
            <dl className="divide-y divide-white/10">
              {DAYS.map((d) => (
                <div
                  key={d.key}
                  className={`flex items-baseline justify-between py-3 text-sm ${
                    d.key === today ? "text-white font-bold" : "text-white/70"
                  }`}
                >
                  <dt className="uppercase tracking-wider">{d.label}</dt>
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
