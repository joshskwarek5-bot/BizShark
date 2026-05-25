import { redirect } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";
import { requireOperator } from "@/lib/auth";

export const metadata = { title: "Outreach templates" };

export default async function OperatorTemplatesPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-surface-900">Outreach templates</h1>
        <p className="text-sm text-surface-500 mt-1">
          Email + script templates you&apos;ll use to pitch leads.
        </p>
      </div>

      <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
          <FileText className="h-6 w-6" />
        </div>
        <div className="mt-4 font-display text-2xl text-surface-900">
          Coming next session
        </div>
        <p className="mt-2 text-surface-600 max-w-md mx-auto text-sm">
          We&apos;ll seed a library of cold-email, follow-up, and in-person pitch templates
          with merge fields for each lead — and a one-click &quot;Build their site&quot; flow
          that pre-fills the new-client form from the lead.
        </p>
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3.5 py-1.5 text-xs font-medium text-surface-700">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          Phase 3
        </div>
      </div>
    </div>
  );
}
