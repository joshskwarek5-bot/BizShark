import { notFound, redirect } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { clientTypeMeta, parseServices } from "@/lib/client-type";
import { ServicesManager } from "@/components/admin/services-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services" };

export default async function AdminServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  if (!clientTypeMeta(r.type).hasServices) redirect(`/r/${slug}/admin`);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <ServicesManager slug={r.slug} initial={parseServices(r.services)} />
    </div>
  );
}
