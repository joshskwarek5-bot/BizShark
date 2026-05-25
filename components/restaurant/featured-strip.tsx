"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface FeaturedItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
}

export function FeaturedStrip({ slug, items }: { slug: string; items: FeaturedItem[] }) {
  return (
    <section className="py-20 md:py-28 bg-surface-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-brand">
              House Favorites
            </div>
            <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
              The classics, done right.
            </h2>
          </div>
          <Link
            href={`/r/${slug}/menu`}
            className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-brand hover:gap-2 transition-all"
          >
            See full menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-3xl bg-white p-7 shadow-soft hover:shadow-elevated transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand/0 via-brand/0 to-brand/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="font-display text-2xl text-surface-900">{item.name}</div>
                {item.description && (
                  <p className="mt-3 text-sm text-surface-600 leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                )}
                <div className="mt-6 flex items-center justify-between">
                  <div className="font-mono text-lg text-surface-900">
                    {formatMoney(item.priceCents)}
                  </div>
                  <Link
                    href={`/r/${slug}/menu`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Add to order →
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
