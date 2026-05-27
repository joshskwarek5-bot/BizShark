// Reusable public-site sections rendered by the vertical templates: Team
// grid, weekly class schedule, gallery, testimonials, FAQs. Each takes
// pre-fetched rows (page does the DB query) so these stay pure UI.

"use client";

import * as React from "react";
import Image from "next/image";
import {
  Star,
  Calendar,
  ExternalLink,
  Quote,
  ChevronDown,
  Instagram,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Team grid
// ============================================================================

export interface PublicStaff {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  specialties: string[];
  bookingUrl: string | null;
  instagram: string | null;
  yearsExperience: number | null;
}

export function TeamSection({
  staff,
  heading = "Meet the team",
  subhead,
}: {
  staff: PublicStaff[];
  heading?: string;
  subhead?: string;
}) {
  if (staff.length === 0) return null;
  return (
    <section
      id="team"
      className="bg-surface-50 py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-4xl text-surface-900">{heading}</h2>
          {subhead && (
            <p className="mt-2 text-surface-600 max-w-xl mx-auto">{subhead}</p>
          )}
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {staff.map((s) => (
            <div
              key={s.id}
              className="rounded-3xl bg-white shadow-soft overflow-hidden"
            >
              <div className="relative aspect-square bg-surface-100">
                {s.photoUrl ? (
                  <Image
                    src={s.photoUrl}
                    alt={s.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 280px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-surface-300">
                    <UserCircle2 className="h-20 w-20" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="font-display text-xl text-surface-900">
                  {s.name}
                </div>
                {s.title && (
                  <div className="text-sm text-surface-500 mt-0.5">{s.title}</div>
                )}
                {s.specialties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.specialties.slice(0, 4).map((sp) => (
                      <span
                        key={sp}
                        className="inline-flex items-center rounded-full bg-surface-100 px-2 py-0.5 text-[11px] text-surface-700"
                      >
                        {sp}
                      </span>
                    ))}
                  </div>
                )}
                {s.bio && (
                  <p className="mt-3 text-sm text-surface-600 line-clamp-3">
                    {s.bio}
                  </p>
                )}
                {(s.bookingUrl || s.instagram) && (
                  <div className="mt-4 flex items-center gap-2">
                    {s.bookingUrl && (
                      <a
                        href={s.bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full bg-brand text-brand-fg px-3 text-xs font-medium shadow-soft hover:brightness-105 transition"
                      >
                        Book with {s.name.split(" ")[0]}{" "}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {s.instagram && (
                      <a
                        href={
                          s.instagram.startsWith("http")
                            ? s.instagram
                            : `https://instagram.com/${s.instagram.replace(/^@/, "")}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 w-9 grid place-items-center rounded-full text-surface-500 hover:bg-surface-100 hover:text-surface-800 transition"
                        title="Instagram"
                      >
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Class schedule (weekly grid)
// ============================================================================

export interface PublicClassSession {
  id: string;
  name: string;
  description: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  instructorName: string | null;
  capacity: number | null;
  level: string | null;
  bookingUrl: string | null;
}

const SCHEDULE_DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

export function ScheduleSection({
  classes,
  heading = "Class schedule",
  subhead = "Weekly recurring — show up, sweat, leave taller.",
  defaultBookingUrl,
}: {
  classes: PublicClassSession[];
  heading?: string;
  subhead?: string;
  defaultBookingUrl?: string | null;
}) {
  const [activeDay, setActiveDay] = React.useState<string | "all">("all");

  if (classes.length === 0) return null;

  const todayKey = SCHEDULE_DAYS[(new Date().getDay() + 6) % 7].key;

  const visible =
    activeDay === "all"
      ? classes
      : classes.filter((c) => c.dayOfWeek === activeDay);

  return (
    <section
      id="schedule"
      className="bg-white py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display text-4xl text-surface-900">{heading}</h2>
          <p className="mt-2 text-surface-600 max-w-xl mx-auto">{subhead}</p>
        </div>

        <div className="flex justify-center gap-1.5 mb-6 flex-wrap">
          <DayChip
            label="All"
            active={activeDay === "all"}
            onClick={() => setActiveDay("all")}
          />
          {SCHEDULE_DAYS.map((d) => (
            <DayChip
              key={d.key}
              label={d.label + (d.key === todayKey ? " · today" : "")}
              active={activeDay === d.key}
              onClick={() => setActiveDay(d.key)}
            />
          ))}
        </div>

        {activeDay === "all" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {SCHEDULE_DAYS.map((d) => {
              const list = classes.filter((c) => c.dayOfWeek === d.key);
              return (
                <div key={d.key} className="rounded-2xl bg-surface-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-2 px-1">
                    {d.label}
                  </div>
                  <div className="space-y-2">
                    {list.length === 0 ? (
                      <div className="text-[10px] text-surface-400 italic text-center py-4">
                        Rest day
                      </div>
                    ) : (
                      list.map((c) => (
                        <ClassCard key={c.id} cls={c} dense />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {visible.length === 0 ? (
              <div className="col-span-full text-center text-sm text-surface-500 italic py-8">
                No classes that day.
              </div>
            ) : (
              visible.map((c) => <ClassCard key={c.id} cls={c} />)
            )}
          </div>
        )}

        {defaultBookingUrl && (
          <div className="mt-8 text-center">
            <a
              href={defaultBookingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand text-brand-fg px-6 text-sm font-medium shadow-soft hover:brightness-105 transition"
            >
              Book a class <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function DayChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
        active
          ? "bg-brand text-brand-fg shadow-soft"
          : "bg-surface-100 text-surface-700 hover:bg-surface-200"
      )}
    >
      {label}
    </button>
  );
}

function ClassCard({
  cls,
  dense,
}: {
  cls: PublicClassSession;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white shadow-soft p-3",
        !dense && "border border-surface-200"
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className={cn("font-mono tabular-nums text-surface-500", dense ? "text-[11px]" : "text-sm")}>
          {cls.startTime}–{cls.endTime}
        </span>
        {cls.level && (
          <span className="text-[10px] uppercase tracking-wider text-surface-400">
            {cls.level}
          </span>
        )}
      </div>
      <div
        className={cn(
          "font-medium text-surface-900 mt-0.5 truncate",
          dense ? "text-sm" : "text-base"
        )}
      >
        {cls.name}
      </div>
      {cls.instructorName && !dense && (
        <div className="text-xs text-surface-500 mt-0.5">
          with {cls.instructorName}
        </div>
      )}
      {!dense && cls.description && (
        <div className="text-xs text-surface-500 mt-1 line-clamp-2">
          {cls.description}
        </div>
      )}
      {!dense && cls.bookingUrl && (
        <a
          href={cls.bookingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          Reserve <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// ============================================================================
// Gallery
// ============================================================================

export interface PublicGalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  tag: string | null;
}

export function GallerySection({
  images,
  heading = "Gallery",
  subhead,
}: {
  images: PublicGalleryImage[];
  heading?: string;
  subhead?: string;
}) {
  const [filter, setFilter] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  if (images.length === 0) return null;

  const tags = Array.from(
    new Set(images.map((i) => i.tag).filter((t): t is string => !!t))
  );
  const visible = filter ? images.filter((i) => i.tag === filter) : images;

  return (
    <section
      id="gallery"
      className="bg-surface-50 py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display text-4xl text-surface-900">{heading}</h2>
          {subhead && (
            <p className="mt-2 text-surface-600 max-w-xl mx-auto">{subhead}</p>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex justify-center gap-1.5 mb-6 flex-wrap">
            <DayChip
              label={`All (${images.length})`}
              active={filter === null}
              onClick={() => setFilter(null)}
            />
            {tags.map((t) => (
              <DayChip
                key={t}
                label={`${t} (${images.filter((i) => i.tag === t).length})`}
                active={filter === t}
                onClick={() => setFilter(t)}
              />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {visible.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightbox(img.imageUrl)}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-surface-100 ring-1 ring-surface-200 hover:ring-brand transition"
            >
              <Image
                src={img.imageUrl}
                alt={img.caption ?? "Gallery photo"}
                fill
                sizes="(max-width: 640px) 50vw, 280px"
                className="object-cover group-hover:scale-105 transition-transform"
              />
              {img.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                  <div className="text-white text-xs">{img.caption}</div>
                </div>
              )}
            </button>
          ))}
        </div>
        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-50 bg-surface-900/90 grid place-items-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
              <Image
                src={lightbox}
                alt="Gallery zoom"
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Testimonials
// ============================================================================

export interface PublicTestimonial {
  id: string;
  quote: string;
  author: string | null;
  rating: number | null;
  source: string;
}

export function TestimonialsSection({
  items,
  heading = "What people are saying",
}: {
  items: PublicTestimonial[];
  heading?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section
      id="reviews"
      className="bg-white py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-4xl text-surface-900">{heading}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.slice(0, 6).map((t) => (
            <div
              key={t.id}
              className="rounded-3xl bg-surface-50 p-6 ring-1 ring-surface-100"
            >
              <Quote className="h-5 w-5 text-brand mb-3" />
              {t.rating && (
                <div className="flex items-center gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3.5 w-3.5",
                        i < t.rating!
                          ? "text-amber-500 fill-amber-500"
                          : "text-surface-300"
                      )}
                    />
                  ))}
                </div>
              )}
              <blockquote className="text-sm text-surface-700 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              {t.author && (
                <div className="mt-4 text-xs font-medium text-surface-600">
                  — {t.author}
                  {t.source !== "manual" && (
                    <span className="text-surface-400 ml-1 capitalize">
                      · {t.source}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ
// ============================================================================

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
}

export function FaqSection({
  items,
  heading = "Frequently asked",
}: {
  items: PublicFaq[];
  heading?: string;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <section
      id="faq"
      className="bg-surface-50 py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-4xl text-surface-900">{heading}</h2>
        </div>
        <div className="space-y-2">
          {items.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl bg-white ring-1 ring-surface-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpen((c) => (c === f.id ? null : f.id))}
                className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-surface-50/60 transition"
              >
                <span className="font-medium text-surface-900">{f.question}</span>
                <Calendar className="h-4 w-4 text-brand shrink-0 hidden" />
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-surface-500 transition-transform shrink-0",
                    open === f.id && "rotate-180"
                  )}
                />
              </button>
              {open === f.id && (
                <div className="px-5 pb-5 text-sm text-surface-700 whitespace-pre-wrap">
                  {f.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
