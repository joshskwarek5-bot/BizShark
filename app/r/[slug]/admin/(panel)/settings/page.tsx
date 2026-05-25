import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-surface-900">Settings</h1>
        <p className="text-sm text-surface-500 mt-1">
          Update your restaurant&apos;s info, hours, branding, and tax rate.
        </p>
      </div>
      <SettingsForm
        slug={r.slug}
        initial={{
          name: r.name,
          tagline: r.tagline,
          description: r.description,
          address: r.address,
          city: r.city,
          state: r.state,
          zip: r.zip,
          phone: r.phone,
          email: r.email,
          primaryColor: r.primaryColor,
          accentColor: r.accentColor,
          taxBps: r.taxBps,
          hours: r.hours,
        }}
      />
    </div>
  );
}
