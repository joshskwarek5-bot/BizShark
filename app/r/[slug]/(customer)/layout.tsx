import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { SiteHeader } from "@/components/restaurant/site-header";
import { SiteFooter } from "@/components/restaurant/site-footer";

export default async function CustomerLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader slug={r.slug} name={r.name} />
      <main className="flex-1">{children}</main>
      <SiteFooter restaurant={r} />
    </div>
  );
}
