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
 * Refined template hero: editorial layout, hairline rules, ample whitespace,
 * tracked-out small-caps eyebrow, image as a tall asymmetric portrait.
 * Best for healthcare, professional services, fine dining, spas — anywhere
 * that wants quiet authority over loud energy.
 */
export function RefinedHero({
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
  primaryCtaLabel = "Book",
  primaryCtaHref,
}: HeroProps) {
  const status = openStatus(hours);
  return (
    <section className="relative bg-[#FAF8F4]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-10 md:pt-16 pb-20 md:pb-28">
        {/* Eyebrow row */}
        <div className="flex items-center justify-between border-b border-surface-900/15 pb-6 mb-12 md:mb-16">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-surface-700">
            {name}
          </div>
          <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-surface-700">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                status.open ? "bg-emerald-600" : "bg-amber-600"
              }`}
            />
            {status.label}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Text — spans 7 cols */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7"
          >
            <div className="text-[11px] font-mono uppercase tracking-[0.4em] text-[var(--brand)]">
              Welcome
            </div>
            <h1 className="mt-6 font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] tracking-tight text-surface-900">
              {heroHeadline || tagline || name}
            </h1>
            {(heroSubhead || tagline) && heroHeadline !== (heroSubhead || tagline) && (
              <p className="mt-8 font-display text-xl md:text-2xl italic text-surface-700 leading-relaxed max-w-2xl">
                {heroSubhead || tagline}
              </p>
            )}

            <div className="mt-12 flex flex-wrap items-center gap-4">
              <Link
                href={primaryCtaHref ?? `/r/${slug}#appointment`}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-surface-900 text-white px-7 text-sm font-medium tracking-wide hover:bg-surface-800 transition"
              >
                {primaryCtaLabel}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={`/r/${slug}#visit`}
                className="inline-flex h-12 items-center text-sm font-medium tracking-wide text-surface-900 border-b border-surface-900 pb-0.5 hover:opacity-70 transition"
              >
                Plan your visit
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs uppercase tracking-wider text-surface-600">
              <div className="inline-flex items-center gap-2">
                <MapPin className="h-3 w-3 text-[var(--brand)]" />
                <span>
                  {address}
                  {city && <span>{` · ${city}, ${state}`}</span>}
                </span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Clock className="h-3 w-3 text-[var(--brand)]" />
                <span>{status.label}</span>
              </div>
            </div>
          </motion.div>

          {/* Image — spans 5 cols, tall portrait */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 relative aspect-[3/4] lg:aspect-[4/5] w-full"
          >
            {heroImageUrl ? (
              <Image
                src={heroImageUrl}
                alt={name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 540px"
                className="object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 grid place-items-center"
                style={{
                  background:
                    "linear-gradient(180deg, var(--brand) 0%, transparent 100%)",
                }}
              >
                <span className="font-display text-5xl text-white/80 px-6 text-center">
                  {name}
                </span>
              </div>
            )}
            {/* Hairline frame */}
            <div className="absolute -bottom-2 -right-2 -left-2 h-px bg-surface-900/30" />
            <div className="absolute -top-2 -right-2 -left-2 h-px bg-surface-900/30" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
