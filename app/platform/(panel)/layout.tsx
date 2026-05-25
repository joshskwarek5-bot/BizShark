import { redirect } from "next/navigation";
import { getCurrentUser, requireSuperAdmin } from "@/lib/auth";
import { PlatformShell } from "@/components/platform/platform-shell";
import { platformLogoutAction } from "./actions";

export default async function PlatformPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) redirect("/platform/login");

  const user = await getCurrentUser();
  return (
    <PlatformShell
      userName={user?.name ?? ""}
      userEmail={user?.email ?? ""}
      onLogout={platformLogoutAction}
    >
      {children}
    </PlatformShell>
  );
}
