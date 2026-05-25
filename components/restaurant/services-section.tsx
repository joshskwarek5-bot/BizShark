"use client";

import { motion } from "motion/react";
import { Sparkles, Phone, ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { type ServiceItem } from "@/lib/client-type";

interface ServicesSectionProps {
  services: ServiceItem[];
  phone: string;
}

export function ServicesSection({ services, phone }: ServicesSectionProps) {
  if (services.length === 0) return null;

  return (
    <section id="services" className="py-20 md:py-28 bg-surface-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-brand">
              What we offer
            </div>
            <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
              Services
            </h2>
          </div>
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:gap-2 transition-all"
          >
            <Phone className="h-4 w-4" /> Call to book
          </a>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-3xl bg-white p-7 shadow-soft hover:shadow-elevated transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand/0 via-brand/0 to-brand/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-display text-xl text-surface-900 leading-snug">
                    {service.name}
                  </div>
                  {service.priceCents != null && (
                    <div className="font-mono text-sm font-medium text-brand whitespace-nowrap shrink-0">
                      {formatMoney(service.priceCents)}
                    </div>
                  )}
                </div>
                {service.duration && (
                  <div className="mt-1 text-xs text-surface-500 font-mono">
                    {service.duration}
                  </div>
                )}
                {service.description && (
                  <p className="mt-3 text-sm text-surface-600 leading-relaxed">
                    {service.description}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex md:hidden">
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand text-brand-fg pl-5 pr-3 text-sm font-medium shadow-soft"
          >
            <Phone className="h-4 w-4" />
            Call to book
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
