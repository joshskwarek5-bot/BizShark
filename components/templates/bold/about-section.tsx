"use client";

import { motion } from "motion/react";

export function BoldAboutSection({ copy }: { copy: string }) {
  if (!copy) return null;
  const paragraphs = copy.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section className="bg-black text-white py-24 md:py-32 border-y border-white/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12 lg:gap-20 items-start">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-24"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--brand)]">
              About
            </div>
            <h2 className="mt-4 font-sans font-black uppercase text-5xl md:text-6xl leading-[0.95] tracking-tight">
              {paragraphs[0]?.split(/[.!?]/)[0].split(" ").slice(0, 5).join(" ") || "Our story"}
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-6 text-lg text-white/85 leading-relaxed"
          >
            {paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? "text-xl md:text-2xl text-white" : ""}>
                {p}
              </p>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
