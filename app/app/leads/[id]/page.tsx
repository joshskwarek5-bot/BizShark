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
import { fillTemplate, tokensInTemplate, type MergeVars } from "@/lib/outreach";
import { LeadDetailControls } from "@/components/operator/lead-detail-controls";
import { PitchPanel } from "@/components/operator/pitch-panel";

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

  // Build the merge-field dictionary for this lead + operator
  const vars: MergeVars = {
    businessName: lead.businessName,
    businessType: lead.businessType ?? undefined,
    city: lead.city ?? undefined,
    state: lead.state ?? undefined,
    address: lead.address ?? undefined,
    phone: lead.phone ?? undefined,
    rating: lead.rating !== null ? lead.rating.toFixed(1) : undefined,
    operatorName: operator.name ?? undefined,
    operatorBusinessName: operator.businessName ?? undefined,
    operatorPhone: operator.pitchPhone ?? undefined,
  };
  if (lead.convertedRestaurantId) {
    const converted = await db.restaurant.findUnique({
      where: { id: lead.convertedRestaurantId },
      select: { slug: true },
    });
    if (converted) vars.previewUrl = `/r/${converted.slug}`;
  }

  // Fetch templates this lead could use: operator's own + platform-default,
  // narrowed by appliesTo when set.
  const allTemplates = await db.outreachTemplate.findMany({
    where: {
      OR: [{ operatorId: operator.id }, { operatorId: null }],
      isArchived: false,
    },
    orderBy: [{ operatorId: "desc" }, { name: "asc" }],
  });
  const applicable = allTemplates.filter((t) => {
    if (!t.appliesTo) return true;
    if (!lead.businessType) return true;
    return (
      t.appliesTo.toLowerCase().includes(lead.businessType.toLowerCase()) ||
      lead.businessType.toLowerCase().includes(t.appliesTo.toLowerCase())
    );
  });

  const rendered = applicable.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    isPlatform: t.operatorId === null,
    subjectRaw: t.subject,
    bodyRaw: t.body,
    subjectRendered: t.subject ? fillTemplate(t.subject, vars) : null,
    bodyRendered: fillTemplate(t.body, vars),
  }));

  // Surface any tokens that didn't resolve so the operator knows what's
  // still a placeholder in the rendered copy.
  const allTokens = new Set<string>();
  for (const t of applicable) {
    tokensInTemplate(t.body).forEach((x) => allTokens.add(x));
    if (t.subject) tokensInTemplate(t.subject).forEach((x) => allTokens.add(x));
  }
  const missingFields = [...allTokens].filter((tok) => {
    const v = (vars as Record<string, unknown>)[tok];
    return v === undefined || v === null || v === "";
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <Link
        href="/app/leads"
        className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-brand mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to pipeline
      </Link>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
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
                    <span className="font-mono tabular-nums">{lead.rating.toFixed(1)}</span>
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

          <PitchPanel templates={rendered} missingFields={missingFields} />

          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-display text-xl text-surface-900">
                  Convert to client
                </div>
                <p className="mt-1 text-sm text-surface-600 max-w-md">
                  Pre-fill the new-client form with this lead&apos;s data and pick a
                  template. After you save, this lead is auto-marked Qualified.
                </p>
                {lead.convertedRestaurantId && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 ring-1 ring-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Site already built — see Clients
                  </div>
                )}
              </div>
              <Link
                href={`/app/clients/new?leadId=${lead.id}`}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-brand pl-5 pr-4 text-sm font-medium text-brand-fg shadow-soft hover:shadow-elevated transition active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                {lead.convertedRestaurantId ? "Build another" : "Build their site"}
              </Link>
            </div>
          </section>
        </div>

        <LeadDetailControls
          id={lead.id}
          initialStatus={lead.status}
          initialNotes={lead.notes}
        />
      </div>
    </div>
  );
}
