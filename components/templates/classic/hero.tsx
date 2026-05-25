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
  heroHeadline?: string | null;
  heroSubhead?: string | null;
  heroImageUrl?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  hours: Hours;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
}

/**
 * Classic template hero: centered serif typography, image as a framed
 * portrait card on the side rather than full-bleed, restrained palette.
 */
export function ClassicHero({
  slug,
  name,
  tagline,
  heroHeadline,
  heroSubhead,
  heroImageUrl,
  address,
  city,
  state,
  hours,
  primaryCtaLabel = "Order online",
  primaryCtaHref,
}: HeroProps) {
  const status = openStatus(hours);

  return (
    <section className="relative isolate overflow-hidden bg-surface-50 border-b border-surface-200">
      <div className="absolute inset-0 grain opacity-40" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          {/* Text column */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-surface-300 bg-white/80 px-3 py-1.5 text-xs font-medium uppercase tracking-widest text-surface-700">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  status.open ? "bg-emerald-500" : "bg-amber-500"
                } animate-pulse`}
              />
              {status.label}
            </div>
            <div className="mt-4 text-sm uppercase tracking-[0.25em] text-brand">
              {name}
            </div>
            <h1 className="mt-3 font-display text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-surface-900">
              {heroHeadline || tagline || name}
            </h1>
            {(heroSubhead || tagline) && (
              <p className="mt-5 font-display text-lg md:text-xl text-surface-700 italic leading-relaxed max-w-xl mx-auto lg:mx-0">
                {heroSubhead || tagline}
              </p>
            )}

            <div className="mt-8 flex flex-wrap justify-center lg:justify-start items-center gap-3">
              <Link
                href={primaryCtaHref ?? `/r/${slug}/menu`}
                className="group inline-flex h-14 items-center gap-2 rounded-none bg-surface-900 px-7 text-base font-medium text-surface-50 hover:bg-surface-800 transition active:scale-[0.98]"
              >
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={`/r/${slug}#visit`}
                className="inline-flex h-14 items-center rounded-none border border-surface-900 bg-transparent px-7 text-base font-medium text-surface-900 hover:bg-surface-900 hover:text-surface-50 transition"
              >
                Visit us
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-surface-700">
              <div className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-brand" />
                <span>
                  {address}
                  {city && <span className="text-surface-500">{` · ${city}, ${state}`}</span>}
                </span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-brand" />
                <span>{status.label}</span>
              </div>
            </div>
          </motion.div>

          {/* Image column — framed portrait */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative mx-auto w-full max-w-md aspect-[3/4]"
          >
            {heroImageUrl ? (
              <>
                <div className="absolute inset-2 border border-surface-900/30" />
                <div className="absolute inset-0 -translate-x-3 -translate-y-3 border-2 border-brand/40 pointer-events-none" />
                <div className="relative h-full w-full overflow-hidden">
                  <Image
                    src={heroImageUrl}
                    alt={`${name} storefront`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 480px"
                    className="object-cover"
                  />
                </div>
              </>
            ) : (
              <div className="relative h-full w-full bg-surface-200 grid place-items-center text-surface-500 font-display text-2xl">
                {name}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
