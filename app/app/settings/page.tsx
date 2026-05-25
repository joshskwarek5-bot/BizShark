import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { OperatorSettingsForm } from "@/components/operator/settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function OperatorSettingsPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-surface-900">Settings</h1>
        <p className="text-sm text-surface-500 mt-1">
          Your agency profile and lead-engine API key.
        </p>
      </div>
      <OperatorSettingsForm
        initial={{
          name: operator.name ?? "",
          businessName: operator.businessName,
          areaCity: operator.areaCity,
          areaState: operator.areaState,
          hasGooglePlacesKey: !!operator.googlePlacesApiKey,
        }}
      />
    </div>
  );
}
