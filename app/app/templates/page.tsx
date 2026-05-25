import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { TemplatesList } from "@/components/operator/templates-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach templates" };

export default async function OperatorTemplatesPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const [yourTemplates, platformTemplates] = await Promise.all([
    db.outreachTemplate.findMany({
      where: { operatorId: operator.id, isArchived: false },
      orderBy: { createdAt: "desc" },
    }),
    db.outreachTemplate.findMany({
      where: { operatorId: null, isArchived: false },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-4xl text-surface-900">Outreach templates</h1>
        <p className="text-sm text-surface-500 mt-1">
          Email + script copy you&apos;ll use when pitching leads. Use{" "}
          <code className="text-xs font-mono">{"{{businessName}}"}</code> and other merge
          fields — they fill in automatically per lead.
        </p>
      </div>
      <TemplatesList yourTemplates={yourTemplates} platformTemplates={platformTemplates} />
    </div>
  );
}
