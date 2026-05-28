import { ShieldCheck } from "lucide-react";
import { PlatformLoginForm } from "./login-form";

export const metadata = { title: "Platform login" };

export default function PlatformLoginPage() {
  return (
    <main className="min-h-screen bg-surface-900 text-white grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-9 w-9 grid place-items-center rounded-xl bg-white text-surface-900">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="font-display text-2xl">Platform</div>
        </div>
        <p className="text-center text-sm text-white/60 mb-8">
          BizShark · Agency Admin
        </p>
        <div className="rounded-3xl bg-white text-surface-900 shadow-elevated p-8">
          <PlatformLoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-white/40">
          For restaurant staff, sign in via your restaurant&apos;s site.
        </p>
      </div>
    </main>
  );
}
