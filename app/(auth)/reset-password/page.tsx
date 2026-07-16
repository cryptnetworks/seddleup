import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { resetPassword } from "@/lib/actions";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const query = await searchParams;
  const token = query.token || "";

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center bg-brand-page px-4 py-8 sm:py-10">
      <section className="auth-card w-full max-w-md p-4 sm:p-6">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <h1 className="text-center text-3xl font-bold text-ink">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted">
          Use at least 8 characters. Reset links can only be used once.
        </p>
        {query.error ? (
          <p className="alert-error mt-4">
            This reset link is invalid or expired. Request a new link.
          </p>
        ) : null}
        <form className="mt-6 grid gap-4" action={resetPassword} data-testid="reset-password-form">
          <input data-testid="reset-password-token" name="token" type="hidden" value={token} />
          <div>
            <label className="label" htmlFor="password">
              New password
            </label>
            <input
              className="field"
              data-testid="reset-password-new"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              className="field"
              data-testid="reset-password-confirm"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </div>
          <button
            className="btn-primary"
            data-testid="reset-password-submit"
            disabled={!token}
            type="submit"
          >
            Update password
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          Need a new link?{" "}
          <Link className="font-semibold text-ocean" href="/forgot-password">
            Request reset
          </Link>
        </p>
      </section>
    </main>
  );
}
