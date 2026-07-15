import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center bg-brand-page px-4 py-8 sm:py-10">
      <section className="auth-card w-full max-w-md p-4 text-center sm:p-6">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <p className="text-sm font-semibold text-ocean">Offline</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">SeddleUp needs a connection.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Reconnect to load your trips, expenses, and latest balances.
        </p>
        <Link className="btn-primary mt-5 w-full" href="/dashboard">
          Try dashboard
        </Link>
      </section>
    </main>
  );
}
