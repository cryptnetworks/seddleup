import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { requestPasswordReset } from "@/lib/actions";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const query = await searchParams;

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center bg-brand-page px-4 py-8 sm:py-10">
      <section className="auth-card w-full max-w-md p-4 sm:p-6">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <h1 className="text-center text-3xl font-bold text-ink">Reset password</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your email and we will send password reset instructions if an account exists.
        </p>
        {query.sent ? (
          <p className="alert-success mt-4">
            If that email is registered, a reset link has been sent.
          </p>
        ) : null}
        <form
          className="mt-6 grid gap-4"
          action={requestPasswordReset}
          data-testid="forgot-password-form"
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="field"
              data-testid="forgot-password-email"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={120}
              required
            />
          </div>
          <button className="btn-primary" data-testid="forgot-password-submit" type="submit">
            Send reset link
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link className="font-semibold text-ocean" href="/login">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
