import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import {
  NewRestaurantForm,
  type InitialFormValues,
} from "@/app/platform/(panel)/restaurants/new/new-restaurant-form";
import { hasAnthropicKey } from "@/app/platform/(panel)/restaurants/new/ai-actions";
import { createClientAsOperator } from "../actions";
import { slugify } from "@/lib/utils";

export const metadata = { title: "New client" };

export default async function OperatorNewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;
  const sp = await searchParams;
  const aiAvailable = await hasAnthropicKey();

  // If leadId is in the URL, look it up + verify it belongs to this operator.
  // We use it to pre-fill the form AND to bind the leadId into the create
  // action so the lead is auto-converted on success.
  let prefillLead: {
    id: string;
    businessName: string;
    businessType: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
  } | null = null;
  if (sp.leadId) {
    const lead = await db.lead.findUnique({ where: { id: sp.leadId } });
    if (lead && lead.operatorId === operator.id) {
      prefillLead = {
        id: lead.id,
        businessName: lead.businessName,
        businessType: lead.businessType,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        phone: lead.phone,
      };
    }
  }

  const initialValues: InitialFormValues | undefined = prefillLead
    ? {
        type: guessTypeFromBusinessType(prefillLead.businessType),
        name: prefillLead.businessName,
        slug: slugify(prefillLead.businessName),
        address: prefillLead.address ?? "",
        city: prefillLead.city ?? "",
        state: prefillLead.state ?? "",
        zip: prefillLead.zip ?? "",
        phone: prefillLead.phone ?? "",
      }
    : undefined;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-surface-900">New client</h1>
          <p className="text-sm text-surface-500 mt-1">
            Spin up a polished landing page in under two minutes. Use AI to draft the copy,
            then edit anything before saving.
          </p>
        </div>
        <NewRestaurantForm
          aiAvailable={aiAvailable}
          createAction={createClientAsOperator}
          initialValues={initialValues}
          leadId={prefillLead?.id}
          adminRequired={false}
          showAutoScrape
          notice={
            prefillLead && (
              <div className="rounded-2xl border-2 border-brand/30 bg-brand/5 p-4 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-surface-800">
                  <div className="font-medium">Pre-filled from lead</div>
                  <p className="text-surface-600 mt-0.5">
                    Pulling in <strong>{prefillLead.businessName}</strong>&apos;s name,
                    contact, and address. Tweak anything below; the lead will be marked
                    Qualified after you save.
                  </p>
                </div>
                <Link
                  href={`/app/leads/${prefillLead.id}`}
                  className="text-xs text-brand hover:underline shrink-0 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to lead
                </Link>
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

function guessTypeFromBusinessType(
  bt: string | null
): "restaurant" | "service_business" {
  if (!bt) return "restaurant";
  const t = bt.toLowerCase();
  if (
    t.includes("restaurant") ||
    t.includes("cafe") ||
    t.includes("bar") ||
    t.includes("food") ||
    t.includes("bakery") ||
    t.includes("pizza") ||
    t.includes("coffee") ||
    t.includes("brewery")
  ) {
    return "restaurant";
  }
  return "service_business";
}
