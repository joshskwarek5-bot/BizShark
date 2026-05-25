import Link from "next/link";
import { Container } from "@/components/ui/container";

export default function RestaurantNotFound() {
  return (
    <main className="min-h-screen bg-surface-50">
      <Container size="sm" className="py-32 text-center">
        <h1 className="font-display text-6xl text-surface-900">Not found</h1>
        <p className="mt-4 text-surface-600">
          We couldn&apos;t find that restaurant. It may have been moved or renamed.
        </p>
        <Link
          href="/"
          className="inline-flex mt-8 h-11 items-center rounded-full bg-brand px-6 text-sm font-medium text-brand-fg shadow-soft"
        >
          ← Back home
        </Link>
      </Container>
    </main>
  );
}
