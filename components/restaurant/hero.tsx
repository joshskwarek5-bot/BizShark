"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import { openStatus, type Hours } from "@/lib/hours";

interface HeroProps {
  slug: string;
  name: string;
  tagline?: string | null;
  heroImageUrl?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  hours: Hours;
}

export function Hero({ slug, name, tagline, heroImageUrl, address, city, state, hours }: HeroProps) {
  const status = openStatus(hours);

  return (
    <section className="relative isolate overflow-hidden bg-surface-900 text-white">
      {heroImageUrl && (
        <Image
          src={heroImageUrl}
          alt={`${name} storefront`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-900/40 via-surface-900/30 to-surface-900/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-brand/30 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 pb-32 md:pt-32 md:pb-44">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/25">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                status.open ? "bg-emerald-300" : "bg-amber-300"
              } animate-pulse`}
            />
            {status.label}
          </div>
          <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[1.05] tracking-tight">
            {name}
          </h1>
          {tagline && (
            <p className="mt-5 text-lg md:text-xl text-white/85 max-w-2xl leading-relaxed">
              {tagline}
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={`/r/${slug}/menu`}
              className="group inline-flex h-14 items-center gap-2 rounded-full bg-white pl-7 pr-5 text-base font-medium text-surface-900 shadow-elevated hover:bg-surface-50 transition active:scale-[0.98]"
            >
              Order online
              <span className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-fg transition group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href={`/r/${slug}/menu`}
              className="inline-flex h-14 items-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md px-7 text-base font-medium text-white hover:bg-white/15 transition"
            >
              View menu
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 px-4 py-3">
              <MapPin className="h-4 w-4 text-white/80" />
              <div className="text-sm">
                {address}
                {city && (
                  <span className="text-white/70">
                    {" · "}
                    {city}, {state}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 px-4 py-3">
              <Clock className="h-4 w-4 text-white/80" />
              <div className="text-sm">{status.label}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
