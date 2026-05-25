import { NewRestaurantForm } from "./new-restaurant-form";

export const metadata = { title: "Add restaurant" };

export default function NewRestaurantPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-surface-900">New restaurant</h1>
          <p className="text-sm text-surface-500 mt-1">
            Create a new client. We&apos;ll provision the site and an admin login.
          </p>
        </div>
        <NewRestaurantForm />
      </div>
    </div>
  );
}
