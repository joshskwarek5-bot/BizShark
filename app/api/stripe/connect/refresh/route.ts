import { NextRequest, NextResponse } from "next/server";
import { startStripeOnboarding } from "@/app/r/[slug]/admin/(panel)/stripe-actions";

export const runtime = "nodejs";

/**
 * Stripe redirects the user here if their AccountLink expired before they
 * finished onboarding. We mint a fresh AccountLink and send them onward.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.redirect(new URL("/", req.url));
  try {
    const res = await startStripeOnboarding(slug);
    if (res.ok) return NextResponse.redirect(res.url);
  } catch (e) {
    console.error("[stripe-connect-refresh]", e);
  }
  return NextResponse.redirect(
    new URL(`/r/${slug}/admin/settings?stripe=error`, req.url)
  );
}
