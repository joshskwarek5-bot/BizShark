import { redirect } from "next/navigation";
import { getCurrentUser, requireRestaurantAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin/admin-shell";
import { logoutAction } from "./actions";

export default async function AdminPanelLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const auth = await requireRestaurantAdmin(slug);

  if (!auth.authorized) {
    if (auth.reason === "unauthenticated") {
      redirect(`/r/${slug}/admin/login`);
    }
    if (auth.reason === "not_found") {
      redirect("/");
    }
    // forbidden: signed in as a different restaurant's admin
    redirect("/");
  }

  const { restaurant, session } = auth;
  const user = await getCurrentUser();

  const newOrderCount = await db.order.count({
    where: { restaurantId: restaurant.id, status: { in: ["new", "preparing"] } },
  });

  const logout = logoutAction.bind(null, slug);

  return (
    <AdminShell
      slug={slug}
      restaurantName={restaurant.name}
      userName={user?.name ?? ""}
      userEmail={session.email ?? ""}
      isSuper={session.role === "super_admin"}
      newOrderCount={newOrderCount}
      onLogout={logout}
    >
      {children}
    </AdminShell>
  );
}
