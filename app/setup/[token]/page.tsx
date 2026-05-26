import { notFound } from "next/navigation";
import { AlertTriangle, Rocket } from "lucide-react";
import { db } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your access" };

export default async function SetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await db.setupLink.findUnique({
    where: { token },
    include: { restaurant: { select: { name: true, slug: true } } },
  });
  if (!link) notFound();

  const isExpired = link.expiresAt < new Date();
  const isUsed = !!link.usedAt;

  return (
    <main className="min-h-screen bg-surface-50 grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 grid place-items-center rounded-xl bg-brand text-brand-fg mb-3">
            <Rocket className="h-5 w-5" />
          </div>
          <h1 className="font-display text-3xl text-surface-900">
            Welcome to {link.restaurant.name}
          </h1>
          <p className="mt-2 text-sm text-surface-600">
            Your website is ready. Set a password to access your admin.
          </p>
        </div>

        <div className="rounded-3xl border border-surface-200 bg-white shadow-elevated p-8">
          {isUsed ? (
            <Notice
              kind="warn"
              title="This link has already been used"
              body={
                <>
                  Try{" "}
                  <a href="/login" className="text-brand font-medium hover:underline">
                    signing in
                  </a>{" "}
                  with the password you set. If you&apos;ve forgotten it, ask whoever
                  sent you this link to generate a new one.
                </>
              }
            />
          ) : isExpired ? (
            <Notice
              kind="warn"
              title="This link has expired"
              body="Ask whoever sent you this link to generate a fresh one."
            />
          ) : (
            <SetupForm token={token} email={link.email} defaultName={link.name} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-surface-500">
          By continuing you become the admin for {link.restaurant.name}&apos;s site. You can
          manage your menu, hours, and orders.
        </p>
      </div>
    </main>
  );
}

function Notice({
  kind,
  title,
  body,
}: {
  kind: "warn";
  title: string;
  body: React.ReactNode;
}) {
  void kind;
  return (
    <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-5 text-sm flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
      <div className="text-amber-900">
        <div className="font-medium">{title}</div>
        <p className="mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
