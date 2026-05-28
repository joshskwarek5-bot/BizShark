import { NewRestaurantForm } from "./new-restaurant-form";
import { hasAnthropicKey } from "./ai-actions";

export const metadata = { title: "New client" };

export default async function NewRestaurantPage() {
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
        <NewRestaurantForm aiAvailable={aiAvailable} aiPhotosAvailable={false} />
      </div>
    </div>
  );
}
