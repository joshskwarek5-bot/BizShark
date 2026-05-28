"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { formatMoney } from "@/lib/utils";

interface FeaturedItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
}

/**
 * Classic featured strip — bordered rectangles, serif type, restrained,
 * heavier separators. Designed to feel like a printed bill of fare rather
 * than a modern restaurant homepage.
 */
export function ClassicFeaturedStrip({
  slug,
  items,
}: {
  slug: string;
  items: FeaturedItem[];
}) {
  if (items.length === 0) return <></>;
  return (
    <section className="py-20 md:py-28 bg-white border-y border-surface-200">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="text-xs font-medium tracking-[0.3em] uppercase text-brand">
            House Favorites
          </div>
          <div className="mx-auto mt-3 h-px w-12 bg-surface-300" />
          <h2 className="mt-4 font-display text-4xl md:text-5xl italic text-surface-900">
            From the kitchen
          </h2>
        </div>

        <div className="grid gap-px bg-surface-200 sm:grid-cols-3 border border-surface-200">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="bg-white p-6 flex flex-col"
            >
              {item.imageUrl && (
                <div className="relative aspect-[5/4] overflow-hidden mb-4 border border-surface-100">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="font-display text-2xl text-surface-900">{item.name}</div>
              {item.description && (
                <p className="mt-2 text-sm text-surface-600 leading-relaxed line-clamp-3 italic">
                  {item.description}
                </p>
              )}
              <div className="mt-auto pt-4 flex items-baseline justify-between border-t border-surface-100 mt-4">
                <div className="font-mono text-base text-surface-900">
                  {formatMoney(item.priceCents)}
                </div>
                <Link
                  href={`/r/${slug}/menu`}
                  className="text-xs font-medium uppercase tracking-widest text-brand hover:underline"
                >
                  Add →
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
