import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { NewRestaurantForm } from "@/app/platform/(panel)/restaurants/new/new-restaurant-form";
import { hasAnthropicKey } from "@/app/platform/(panel)/restaurants/new/ai-actions";
import { createClientAsOperator } from "../actions";

export const metadata = { title: "New client" };

export default async function OperatorNewClientPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const aiAvailable = await hasAnthropicKey();

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
          successHref={(slug) => `/r/${slug}`}
        />
      </div>
    </div>
  );
}
