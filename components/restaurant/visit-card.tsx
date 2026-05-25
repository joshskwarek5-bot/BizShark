import Link from "next/link";
import { MapPin, Phone, Clock, ArrowUpRight } from "lucide-react";
import { type Restaurant } from "@prisma/client";
import { parseHours, DAYS, formatDayHours, getCurrentDayKey, openStatus } from "@/lib/hours";

export function VisitCard({ restaurant }: { restaurant: Restaurant }) {
  const hours = parseHours(restaurant.hours);
  const today = getCurrentDayKey();
  const status = openStatus(hours);
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(
    `${restaurant.name} ${restaurant.address} ${restaurant.city ?? ""} ${restaurant.state ?? ""}`
  )}`;

  return (
    <section id="visit" className="py-20 md:py-28 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 items-start">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-brand">Visit Us</div>
            <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
              Stop in, or order ahead.
            </h2>
            <p className="mt-5 text-surface-600 leading-relaxed max-w-lg">
              We&apos;re a neighborhood spot serving breakfast and lunch every day of the week.
              Walk in, call in, or order online — your booth is ready.
            </p>

            <div className="mt-8 space-y-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl bg-surface-50 border border-surface-200 px-5 py-4 hover:bg-surface-100 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 grid place-items-center rounded-full bg-brand/10 text-brand">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-surface-900">{restaurant.address}</div>
                    <div className="text-sm text-surface-600">
                      {restaurant.city}, {restaurant.state} {restaurant.zip}
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-surface-400 group-hover:text-brand transition" />
              </a>

              <a
                href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`}
                className="flex items-center justify-between rounded-2xl bg-surface-50 border border-surface-200 px-5 py-4 hover:bg-surface-100 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 grid place-items-center rounded-full bg-brand/10 text-brand">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-surface-900">{restaurant.phone}</div>
                    <div className="text-sm text-surface-600">Call to ask anything</div>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-surface-400 group-hover:text-brand transition" />
              </a>

              <Link
                href={`/r/${restaurant.slug}/menu`}
                className="flex items-center justify-between rounded-2xl bg-brand text-brand-fg px-5 py-4 hover:brightness-105 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 grid place-items-center rounded-full bg-white/20 text-brand-fg">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">Order online for pickup</div>
                    <div className="text-sm text-brand-fg/80">Skip the line — pay at pickup</div>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-brand-fg/80 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>
          </div>

          <div id="hours" className="rounded-3xl border border-surface-200 bg-surface-50 p-2 shadow-soft">
            <div className="rounded-[20px] bg-white p-7">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-mono uppercase tracking-widest text-surface-500">
                  Hours
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    status.open
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status.open ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {status.label}
                </span>
              </div>
              <dl className="mt-6 divide-y divide-surface-100">
                {DAYS.map((d) => {
                  const isToday = d.key === today;
                  return (
                    <div
                      key={d.key}
                      className={`flex items-center justify-between py-3 ${
                        isToday ? "font-medium text-surface-900" : "text-surface-700"
                      }`}
                    >
                      <dt className="flex items-center gap-2">
                        {isToday && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                        {d.label}
                      </dt>
                      <dd className="font-mono text-sm tabular-nums">
                        {formatDayHours(hours[d.key])}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
