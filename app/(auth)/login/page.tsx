import Link from "next/link";
import { LoginForm } from "@/components/AuthForm";
import { BrandLogo } from "@/components/BrandLogo";
import { OAuthButtons } from "@/components/OAuthButtons";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{
    registered?: string;
    reset?: string;
    logout?: string;
    verify?: string;
    verified?: string;
    verificationSent?: string;
    oauth?: string;
  }>;
}) {
  const query = await searchParams;

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center bg-brand-page px-4 py-8 sm:py-10">
      <section className="auth-card w-full max-w-md p-4 sm:p-6">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <h1 className="text-center text-3xl font-bold text-ink">Login</h1>
        <p className="mt-2 text-sm text-muted">
          Track trip costs, split expenses, and settle up clearly.
        </p>
        {query.registered ? (
          <p className="status-success mt-4">
            Account created. Verify your email before logging in.
          </p>
        ) : null}
        {query.verify ? (
          <p className="status-success mt-4">Check your inbox for a verification link.</p>
        ) : null}
        {query.verified ? (
          <p className="status-success mt-4">Email verified. Login to continue.</p>
        ) : null}
        {query.verificationSent ? (
          <p className="status-success mt-4">
            If that email needs verification, a new link has been sent.
          </p>
        ) : null}
        {query.reset ? (
          <p className="status-success mt-4">Password updated. Login with your new password.</p>
        ) : null}
        {query.logout ? <p className="status-success mt-4">You have been logged out.</p> : null}
        {query.oauth && query.oauth !== "complete" ? (
          <p className="status-danger mt-4">OAuth sign-in failed: {query.oauth}.</p>
        ) : null}
        <div className="mt-6">
          <LoginForm />
        </div>
        <OAuthButtons />
        <p className="mt-4 text-center text-sm">
          <Link className="font-semibold text-ocean" href="/forgot-password">
            Forgot password?
          </Link>
        </p>
        <p className="mt-5 text-center text-sm text-muted">
          Need an account?{" "}
          <Link className="font-semibold text-ocean" href="/register">
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
