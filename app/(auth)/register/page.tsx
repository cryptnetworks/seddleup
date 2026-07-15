import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { registerUser } from "@/lib/actions";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const errorMessage =
    query.error === "exists"
      ? "A user with that username or email already exists."
      : query.error
        ? "Check the form and try again."
        : "";

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center bg-brand-page px-4 py-8 sm:py-10">
      <section className="auth-card w-full max-w-md p-4 sm:p-6">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <h1 className="text-center text-3xl font-bold text-ink">Register</h1>
        <p className="mt-2 text-sm text-muted">
          Create an account to keep your trips private and synced.
        </p>
        {errorMessage ? (
          <p className="alert-error mt-4" id="register-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <form className="mt-6 grid gap-4" action={registerUser} data-testid="register-form">
          <div>
            <label className="label" htmlFor="username">
              Username
            </label>
            <input
              className="field"
              aria-describedby={errorMessage ? "register-error" : undefined}
              aria-invalid={errorMessage ? true : undefined}
              data-testid="register-username"
              id="username"
              name="username"
              minLength={3}
              maxLength={80}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="field"
              aria-describedby={errorMessage ? "register-error" : undefined}
              aria-invalid={errorMessage ? true : undefined}
              data-testid="register-email"
              id="email"
              name="email"
              type="email"
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="field"
              aria-describedby={errorMessage ? "register-error" : undefined}
              aria-invalid={errorMessage ? true : undefined}
              data-testid="register-password"
              id="password"
              name="password"
              type="password"
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
              aria-describedby={errorMessage ? "register-error" : undefined}
              aria-invalid={errorMessage ? true : undefined}
              data-testid="register-confirm-password"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={8}
              maxLength={128}
              required
            />
          </div>
          <button className="btn-primary" data-testid="register-submit" type="submit">
            Create account
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link className="font-semibold text-ocean" href="/login">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
