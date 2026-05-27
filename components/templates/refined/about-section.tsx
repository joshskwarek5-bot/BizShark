"use client";

import { motion } from "motion/react";

export function RefinedAboutSection({ copy }: { copy: string }) {
  if (!copy) return null;
  const paragraphs = copy.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section className="py-24 md:py-32 bg-[#FAF8F4]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--brand)] text-center">
            About
          </div>
          <div className="mt-6 mx-auto h-px w-12 bg-surface-900/30" />
          <h2 className="mt-6 font-display text-4xl md:text-5xl text-surface-900 text-center tracking-tight">
            Our story
          </h2>

          <div className="mt-12 space-y-7 text-surface-800 leading-[1.75] text-lg max-w-2xl mx-auto">
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className={
                  i === 0
                    ? "font-display text-2xl italic text-surface-900 leading-relaxed"
                    : ""
                }
              >
                {p}
              </p>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
