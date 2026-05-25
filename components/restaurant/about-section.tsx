"use client";

import { motion } from "motion/react";

export function AboutSection({ copy }: { copy: string }) {
  if (!copy) return null;
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-xs font-mono uppercase tracking-widest text-brand text-center">
            About us
          </div>
          <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900 text-center">
            Our story
          </h2>
          <div className="mt-8 text-surface-700 leading-relaxed text-lg space-y-4 [&>p]:leading-relaxed">
            {copy.split(/\n\s*\n/).map((para, i) => (
              <p key={i}>{para.trim()}</p>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
