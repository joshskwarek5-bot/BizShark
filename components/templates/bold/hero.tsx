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
 * Bold template hero: full-bleed image, massive sans display headline
 * overlaid bottom-left, hard sharp-cornered buttons, high-contrast.
 * Tuned for gyms, breweries, modern restaurants, anything that wants
 * "loud and confident" energy.
 */
export function BoldHero({
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
  primaryCtaLabel = "Get started",
  primaryCtaHref,
}: HeroProps) {
  const status = openStatus(hours);
  return (
    <section className="relative isolate overflow-hidden bg-black text-white min-h-[88vh] grid">
      {heroImageUrl ? (
        <Image
          src={heroImageUrl}
          alt={`${name}`}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, var(--brand), #000)" }}
        />
      )}
      {/* Dark gradient overlay anchored bottom-left for legibility */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/40 to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10 self-end pb-16 md:pb-24 pt-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 rounded-none border border-white/20 bg-white/5 backdrop-blur-sm px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.25em] text-white/90">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                status.open ? "bg-emerald-400" : "bg-amber-400"
              } animate-pulse`}
            />
            {status.label}
          </div>
          <h1 className="mt-5 font-sans font-black uppercase text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] leading-[0.9] tracking-tight">
            {heroHeadline || tagline || name}
          </h1>
          {(heroSubhead || tagline) && heroHeadline !== (heroSubhead || tagline) && (
            <p className="mt-6 text-lg md:text-xl text-white/85 max-w-2xl leading-relaxed">
              {heroSubhead || tagline}
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={primaryCtaHref ?? `/r/${slug}/menu`}
              className="group inline-flex h-14 items-center gap-3 bg-[var(--brand)] text-[var(--brand-fg)] px-8 text-base font-bold uppercase tracking-wider hover:brightness-110 transition active:scale-[0.98]"
            >
              {primaryCtaLabel}
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href={`/r/${slug}#visit`}
              className="inline-flex h-14 items-center bg-transparent border-2 border-white/80 text-white px-8 text-base font-bold uppercase tracking-wider hover:bg-white hover:text-black transition"
            >
              Visit
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/80">
            <div className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[var(--brand)]" />
              <span>
                {address}
                {city && <span className="text-white/60">{` · ${city}, ${state}`}</span>}
              </span>
            </div>
            <div className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--brand)]" />
              <span>{status.label}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
