import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireOperator } from "@/lib/auth";
import { PlanPicker } from "./plan-picker";

export const metadata = { title: "Choose your plan · BizShark" };

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  // Already subscribed — send them in
  if (operator.stripeSubscriptionId) redirect("/app");

  const sp = await searchParams;
  const canceled = sp.checkout === "canceled";

  return (
    <main className="min-h-screen bg-surface-50 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <Image
              src="/brand/bizshark-logo.jpeg"
              alt="BizShark"
              width={48}
              height={48}
              className="rounded-xl"
            />
          </div>
          <h1 className="font-display text-4xl text-surface-900">
            Pick your plan
          </h1>
          <p className="mt-2 text-surface-500">
            3-day free trial on every plan · Your card won't be charged until day 4
          </p>
          <p className="mt-1 text-sm text-surface-400">
            Signed in as <strong>{operator.email}</strong>
            {" · "}
            <Link href="/logout" className="text-brand hover:underline">Sign out</Link>
          </p>
        </div>

        <PlanPicker canceled={canceled} />
      </div>
    </main>
  );
}
