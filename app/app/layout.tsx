import { redirect } from "next/navigation";
import { getCurrentUser, requireOperator } from "@/lib/auth";
import { OperatorShell } from "@/components/operator/operator-shell";
import { operatorLogoutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireOperator();
  if (!auth.authorized) {
    if (auth.reason === "unauthenticated") redirect("/login");
    // operator role but no operator row, or wrong role
    redirect("/login");
  }
  const { operator } = auth;
  const user = await getCurrentUser();

  return (
    <OperatorShell
      operatorName={operator.name ?? "Your agency"}
      businessName={operator.businessName}
      userName={user?.name ?? ""}
      userEmail={user?.email ?? ""}
      onLogout={operatorLogoutAction}
    >
      {children}
    </OperatorShell>
  );
}
