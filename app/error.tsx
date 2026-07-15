"use client";

import { useEffect } from "react";
import { BrandLogo } from "@/components/BrandLogo";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "app.error_boundary",
        time: new Date().toISOString(),
        digest: error.digest
      })
    );
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-page px-4 py-10">
      <section className="auth-card w-full max-w-md p-6 text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <p className="text-xs font-bold uppercase tracking-normal text-coral">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">SeddleUp could not load this view.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Try again. If the problem continues, check the server logs for the error digest.
        </p>
        <button className="btn-primary mt-5 w-full" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
