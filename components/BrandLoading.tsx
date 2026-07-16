import { BrandLogo } from "@/components/BrandLogo";

export function BrandLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-page px-4 py-10">
      <div className="auth-card flex w-full max-w-sm flex-col items-center gap-5 p-8 text-center">
        <BrandLogo priority />
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-ocean"
          role="status"
          aria-label="Loading SeddleUp"
        />
        <div>
          <p className="font-semibold text-ink">Loading your trip ledger</p>
          <p className="mt-1 text-sm text-muted">This should only take a moment.</p>
        </div>
      </div>
    </main>
  );
}
