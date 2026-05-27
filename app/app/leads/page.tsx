import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { computeLeadCapacity, getTier } from "@/lib/subscriptions";
import { LeadPipeline } from "@/components/operator/lead-pipeline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

export default async function OperatorLeadsPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const [leads, totalLeadCount] = await Promise.all([
    db.lead.findMany({
      where: { operatorId: operator.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        rating: true,
        reviewCount: true,
        status: true,
      },
    }),
    db.lead.count({ where: { operatorId: operator.id } }),
  ]);

  const tier = getTier(operator.subscriptionTier);
  const capacity = computeLeadCapacity(totalLeadCount, tier.maxLeads);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="font-display text-4xl text-surface-900">Leads</h1>
        <p className="text-sm text-surface-500 mt-1">
          Local businesses without websites. Pitch, follow up, close.
        </p>
      </div>

      <LeadPipeline
        leads={leads}
        defaultCity={operator.areaCity}
        defaultState={operator.areaState}
        hasApiKey={!!operator.googlePlacesApiKey}
        capacity={capacity}
        tierName={tier.name}
      />
    </div>
  );
}
