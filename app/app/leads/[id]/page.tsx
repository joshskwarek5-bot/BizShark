import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  MapPin,
  Phone,
  Star,
  CalendarClock,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { leadStatusLabel, leadStatusTone } from "@/lib/lead-status";
import { LeadDetailControls } from "@/components/operator/lead-detail-controls";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || lead.operatorId !== operator.id) notFound();

  const tone = leadStatusTone(lead.status);
  const mapsUrl = lead.address
    ? `https://maps.google.com/?q=${encodeURIComponent(lead.address)}`
    : null;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <Link
        href="/app/leads"
        className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-brand mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to pipeline
      </Link>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Main column */}
        <div className="space-y-6">
          <header className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-display text-3xl md:text-4xl text-surface-900">
                  {lead.businessName}
                </h1>
                {lead.businessType && (
                  <div className="mt-1.5 text-sm text-surface-500 capitalize">
                    {lead.businessType.replace(/_/g, " ")}
                  </div>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                {leadStatusLabel(lead.status)}
              </span>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
              {lead.address && (
                <a
                  href={mapsUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 rounded-xl bg-surface-50 px-3 py-2.5 hover:bg-surface-100 transition group"
                >
                  <MapPin className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-surface-900">{lead.address}</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-surface-400 mt-0.5 opacity-0 group-hover:opacity-100" />
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-3 rounded-xl bg-brand/5 px-3 py-2.5 hover:bg-brand/10 transition"
                >
                  <Phone className="h-4 w-4 text-brand shrink-0" />
                  <div className="font-medium text-surface-900">{lead.phone}</div>
                </a>
              )}
              {lead.websiteUrl ? (
                <a
                  href={lead.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl bg-surface-50 px-3 py-2.5 hover:bg-surface-100 transition"
                >
                  <Globe className="h-4 w-4 text-surface-500 shrink-0" />
                  <div className="text-surface-700 text-xs font-mono truncate">
                    {lead.websiteUrl}
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2.5">
                  <Globe className="h-4 w-4 text-amber-700 shrink-0" />
                  <div className="text-amber-800 text-sm font-medium">
                    No website — your opportunity
                  </div>
                </div>
              )}
              {lead.rating !== null && (
                <div className="flex items-center gap-3 rounded-xl bg-surface-50 px-3 py-2.5">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
                  <div className="text-surface-900">
                    <span className="font-mono tabular-nums">
                      {lead.rating.toFixed(1)}
                    </span>
                    {lead.reviewCount !== null && (
                      <span className="text-surface-500 ml-1">
                        ({lead.reviewCount} reviews)
                      </span>
                    )}
                  </div>
                </div>
              )}
              {lead.lastContactedAt && (
                <div className="flex items-center gap-3 rounded-xl bg-surface-50 px-3 py-2.5">
                  <CalendarClock className="h-4 w-4 text-surface-500 shrink-0" />
                  <div className="text-sm text-surface-700">
                    Last contacted {lead.lastContactedAt.toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Pitch / build-site placeholder for Phase 3 */}
          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-surface-500 mb-3">
              <Sparkles className="h-4 w-4 text-brand" />
              <span className="uppercase tracking-wider text-xs">Pitch</span>
            </div>
            <p className="text-surface-700 leading-relaxed">
              Email + script templates land here next session (Phase 3). For now, copy
              the phone number above and reach out — mention you noticed they don&apos;t
              have a website and could spin one up in a day.
            </p>
            <div className="mt-4 rounded-xl bg-surface-50 p-4 text-sm text-surface-700">
              <div className="font-medium text-surface-900 mb-1">Quick pitch idea</div>
              <p className="italic">
                &ldquo;Hey, I noticed {lead.businessName} doesn&apos;t have a website
                yet. I build polished sites for local businesses in {lead.city ?? "your area"} —
                want me to mock one up for free so you can see how it&apos;d look?&rdquo;
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/app/clients/new"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-brand-fg shadow-soft hover:brightness-105"
              >
                <Sparkles className="h-4 w-4" /> Build their site now
              </Link>
            </div>
          </section>
        </div>

        {/* Sidebar — status + notes + danger */}
        <LeadDetailControls
          id={lead.id}
          initialStatus={lead.status}
          initialNotes={lead.notes}
        />
      </div>
    </div>
  );
}
