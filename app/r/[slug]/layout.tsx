import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { themeStyle } from "@/lib/theme";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) return {};
  return {
    title: { default: r.name, template: `%s · ${r.name}` },
    description: r.description ?? r.tagline ?? undefined,
  };
}

export default async function RestaurantThemeLayout({
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
    <div style={themeStyle(r.primaryColor, r.accentColor)} className="min-h-screen">
      {children}
    </div>
  );
}
