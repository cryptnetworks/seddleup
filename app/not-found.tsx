import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-page px-4 py-10">
      <section className="auth-card w-full max-w-md p-6 text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <p className="text-sm font-semibold text-ocean">Not found</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">This page is not available.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The trip, expense, or page may have been deleted or you may not have access.
        </p>
        <Link className="btn-primary mt-5 w-full" href="/dashboard">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
