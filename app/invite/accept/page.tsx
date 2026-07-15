import Link from "next/link";
import { getServerSession } from "next-auth";
import { BrandLogo } from "@/components/BrandLogo";
import { acceptInvitationAndCreateAccount, acceptInvitationAsCurrentUser } from "@/lib/actions";
import { authOptions } from "@/lib/auth";
import { getInvitationContextByToken } from "@/lib/invitations";
import { prisma } from "@/lib/prisma";

const errorMessages: Record<string, string> = {
  invalid: "This invitation link is invalid.",
  expired: "This invitation has expired.",
  revoked: "This invitation has been revoked.",
  accepted: "This invitation has already been accepted.",
  "email-mismatch": "This invitation belongs to a different email address.",
  "existing-user": "An account already exists for this invitation email. Sign in to accept it.",
  "duplicate-user": "That username is already in use.",
  "invalid-form": "Check the form and try again.",
  "rate-limit": "Too many attempts. Try again later."
};

function invitationPageError(input: {
  queryError?: string;
  token?: string;
  invitationStatus?: string;
}) {
  if (input.queryError) return input.queryError;
  if (!input.token) return "invalid";
  if (!input.invitationStatus) return "invalid";
  return input.invitationStatus === "pending" ? "" : input.invitationStatus;
}

export default async function AcceptInvitationPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const query = await searchParams;
  const token = query.token || "";
  const session = await getServerSession(authOptions);
  const invitation = token ? await getInvitationContextByToken(token) : null;
  const statusError = invitationPageError({
    queryError: query.error,
    token,
    invitationStatus: invitation?.status
  });
  const existingUser = invitation
    ? await prisma.user.findUnique({
        where: { email: invitation.email },
        select: { id: true }
      })
    : null;
  const signedInUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true }
      })
    : null;
  const callbackUrl = `/invite/accept?token=${encodeURIComponent(token)}`;
  const canAcceptAsCurrentUser =
    invitation &&
    signedInUser &&
    signedInUser.email.toLowerCase() === invitation.email &&
    invitation.status === "pending" &&
    !query.error;

  return (
    <main className="flex min-h-screen min-w-0 items-center justify-center bg-brand-page px-4 py-8 sm:py-10">
      <section className="auth-card w-full max-w-lg p-4 sm:p-6">
        <div className="mb-6 flex justify-center">
          <BrandLogo href="/" priority />
        </div>
        <h1 className="text-center text-3xl font-bold text-ink">Accept invitation</h1>
        {statusError ? (
          <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-coral">
            {errorMessages[statusError] || "This invitation cannot be accepted."}
          </p>
        ) : null}
        {invitation && !statusError ? (
          <div className="mt-4 rounded-lg border border-line bg-surface p-4">
            <p className="break-all text-sm font-semibold text-ink">{invitation.email}</p>
            <p className="mt-1 text-sm text-muted">
              {invitation.invitedBy.username || invitation.invitedBy.email} invited you to SeddleUp
              {invitation.trip ? ` for ${invitation.trip.name}` : ""}.
            </p>
            <p className="mt-1 text-xs text-muted">
              Expires {invitation.expiresAt.toLocaleDateString()}.
            </p>
          </div>
        ) : null}

        {canAcceptAsCurrentUser ? (
          <form className="mt-6 grid gap-4" action={acceptInvitationAsCurrentUser}>
            <input name="token" type="hidden" value={token} />
            <button className="btn-primary" type="submit">
              Accept invitation
            </button>
          </form>
        ) : null}

        {invitation && signedInUser && signedInUser.email.toLowerCase() !== invitation.email ? (
          <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-coral">
            Sign in as {invitation.email} to accept this invitation.
          </p>
        ) : null}

        {invitation && !signedInUser && existingUser && !statusError ? (
          <Link
            className="btn-primary mt-6 w-full"
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          >
            Sign in to accept
          </Link>
        ) : null}

        {invitation && !signedInUser && !existingUser && !statusError ? (
          <form className="mt-6 grid gap-4" action={acceptInvitationAndCreateAccount}>
            <input name="token" type="hidden" value={token} />
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="field" id="email" type="email" value={invitation.email} readOnly />
            </div>
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                className="field"
                id="username"
                name="username"
                defaultValue={invitation.displayName || ""}
                minLength={3}
                maxLength={80}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                className="field"
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
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
            <button className="btn-primary" type="submit">
              Create account and accept
            </button>
          </form>
        ) : null}

        <p className="mt-5 text-center text-sm text-muted">
          <Link className="font-semibold text-ocean" href="/login">
            Back to login
          </Link>
        </p>
      </section>
    </main>
  );
}
