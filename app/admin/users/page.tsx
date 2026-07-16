import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import {
  deleteUser,
  inviteUser,
  resendUserInvitation,
  resetUserMfa,
  resetUserPassword,
  revokeUserInvitation,
  setUserDisabled,
  transferTripOwnership,
  updateUserRole
} from "@/lib/actions";
import { requireAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

function inviteStatusMessage(status?: string) {
  if (!status) return "";
  if (status === "sent") return "Invitation sent.";
  if (status === "resent") return "Invitation resent.";
  if (status === "revoked") return "Invitation revoked.";
  if (status === "existing-user") return "That email already belongs to an existing user.";
  if (status === "duplicate-pending") return "A pending invitation already exists for that email.";
  if (status === "rate-limit") return "Too many invitation requests. Try again later.";
  return `Invitation action blocked: ${status}.`;
}

function isInviteSuccess(status?: string) {
  return status === "sent" || status === "resent" || status === "revoked";
}

function transferStatusMessage(status?: string) {
  if (!status) return "";
  if (status === "success") return "Trip ownership transferred.";
  if (status === "replacement-disabled") return "Choose an active replacement owner.";
  if (status === "replacement-readonly") return "A readonly account cannot own a trip.";
  if (status === "same-owner") return "Choose a different replacement owner.";
  if (status === "ownership-changed") {
    return "Trip ownership changed while this form was open. Refresh and try again.";
  }
  return `Ownership transfer blocked: ${status}.`;
}

function mfaStatusMessage(status?: string) {
  if (!status) return "";
  if (status === "reset") return "Multi-factor authentication reset and active sessions revoked.";
  if (status === "confirmation") return "MFA reset blocked: enter the exact username to confirm.";
  if (status === "rate-limit") return "Too many MFA reset attempts. Try again later.";
  if (status === "not-configured") return "That account does not have MFA configured.";
  return "MFA reset blocked: invalid account.";
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
    error?: string;
    invite?: string;
    transfer?: string;
    mfa?: string;
    count?: string;
  }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page || "1"));
  const pageSize = 20;
  const where = {
    role: query.role && query.role !== "all" ? query.role : undefined,
    disabledAt:
      query.status === "disabled" ? { not: null } : query.status === "active" ? null : undefined,
    OR: query.q
      ? [{ email: { contains: query.q } }, { username: { contains: query.q } }]
      : undefined
  };
  const [users, total, pendingInvites, replacementOwners] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        authAccounts: true,
        trips: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } }
      }
    }),
    prisma.user.count({ where }),
    prisma.invitation.findMany({
      where: { status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        invitedBy: { select: { email: true, username: true } },
        trip: { select: { name: true } }
      }
    }),
    prisma.user.findMany({
      where: { disabledAt: null, role: { in: ["owner", "admin", "user"] } },
      select: { id: true, username: true, email: true },
      orderBy: { username: "asc" }
    })
  ]);
  const inviteMessage = inviteStatusMessage(query.invite);
  const transferMessage = transferStatusMessage(query.transfer);
  const mfaMessage = mfaStatusMessage(query.mfa);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="Manage user roles, status, local passwords, and linked authentication providers."
      />
      {query.error ? (
        <p className="alert-error mb-4">
          {query.error === "owned-trips"
            ? `Account deletion blocked: transfer ${query.count || "the"} owned trip(s) first.`
            : `Action blocked: ${query.error}.`}
        </p>
      ) : null}
      {transferMessage ? (
        <p className={`${query.transfer === "success" ? "alert-success" : "alert-error"} mb-4`}>
          {transferMessage}
        </p>
      ) : null}
      {inviteMessage ? (
        <p className={`${isInviteSuccess(query.invite) ? "alert-success" : "alert-error"} mb-4`}>
          {inviteMessage}
        </p>
      ) : null}
      {mfaMessage ? (
        <p
          className={`mb-4 rounded-lg border border-line p-3 text-sm ${
            query.mfa === "reset" ? "bg-teal-50 text-ocean" : "bg-surface text-coral"
          }`}
          role={query.mfa === "reset" ? "status" : "alert"}
        >
          {mfaMessage}
        </p>
      ) : null}
      <section className="card mb-4 grid gap-4 p-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Invite user</h2>
          <p className="text-sm text-muted">Send a SeddleUp invitation to create a new account.</p>
        </div>
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]" action={inviteUser}>
          <input
            className="field"
            name="email"
            type="email"
            placeholder="Email address"
            maxLength={120}
            required
          />
          <input
            className="field"
            name="displayName"
            placeholder="Display name optional"
            maxLength={120}
          />
          <select className="field" name="role" defaultValue="user">
            <option value="user">User</option>
            <option value="readonly">Readonly</option>
          </select>
          <button className="btn-primary" type="submit">
            Invite user
          </button>
        </form>
      </section>

      <section className="card mb-4 p-4">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">Pending invitations</h2>
            <p className="text-sm text-muted">Open SeddleUp invites that have not been accepted.</p>
          </div>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
            {pendingInvites.length} pending
          </span>
        </div>
        {pendingInvites.length === 0 ? (
          <p className="text-sm text-muted">No pending invitations.</p>
        ) : (
          <div className="grid gap-3">
            {pendingInvites.map((invite) => (
              <article
                key={invite.id}
                className="flex flex-col gap-3 rounded-lg border border-line p-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <h3 className="break-all font-semibold text-ink">{invite.email}</h3>
                  <p className="text-sm text-muted">
                    {invite.role || "user"} · Expires {invite.expiresAt.toLocaleDateString()}
                    {invite.trip ? ` · Trip: ${invite.trip.name}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    Invited by {invite.invitedBy.username || invite.invitedBy.email}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <form action={resendUserInvitation}>
                    <input name="invitationId" type="hidden" value={invite.id} />
                    <button className="btn-secondary w-full" type="submit">
                      Resend
                    </button>
                  </form>
                  <form action={revokeUserInvitation}>
                    <input name="invitationId" type="hidden" value={invite.id} />
                    <button className="btn-danger w-full" type="submit">
                      Revoke
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <form className="card mb-4 grid gap-3 p-4 md:grid-cols-4">
        <input className="field" name="q" placeholder="Search users" defaultValue={query.q || ""} />
        <select className="field" name="role" defaultValue={query.role || "all"}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="readonly">Readonly</option>
        </select>
        <select className="field" name="status" defaultValue={query.status || "all"}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <button className="btn-primary" type="submit">
          Filter
        </button>
      </form>

      <div className="grid gap-3">
        {users.map((user) => (
          <article key={user.id} className="card p-4" data-testid="admin-user-card">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="break-all font-semibold text-ink">{user.email}</h2>
                <p className="text-sm text-muted">
                  {user.username} · {user.role} · {user.disabledAt ? "Disabled" : "Active"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Created {user.createdAt.toLocaleDateString()} · Last login{" "}
                  {user.lastLoginAt?.toLocaleString() || "Never"} · Providers{" "}
                  {user.authAccounts.map((account) => account.providerId).join(", ") || "local"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  MFA: {user.twoFactorMethod === "none" ? "Not configured" : user.twoFactorMethod}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[520px]">
                <form
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2"
                  action={updateUserRole}
                >
                  <input name="userId" type="hidden" value={user.id} />
                  <select
                    className="field min-h-11 py-2 text-sm"
                    name="role"
                    defaultValue={user.role}
                  >
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="readonly">Readonly</option>
                  </select>
                  <button className="btn-secondary" type="submit">
                    Save
                  </button>
                </form>
                {user.twoFactorMethod !== "none" || user.authenticatorEnabled ? (
                  <form
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:col-span-2"
                    action={resetUserMfa}
                  >
                    <input name="userId" type="hidden" value={user.id} />
                    <label className="sr-only" htmlFor={`mfa-confirmation-${user.id}`}>
                      Enter {user.username} to confirm MFA reset
                    </label>
                    <input
                      autoComplete="off"
                      className="field min-h-11 py-2 text-sm"
                      id={`mfa-confirmation-${user.id}`}
                      name="confirmation"
                      placeholder={`Enter ${user.username} to confirm`}
                      required
                    />
                    <button className="btn-danger" type="submit">
                      Reset MFA
                    </button>
                  </form>
                ) : null}
                <form action={setUserDisabled}>
                  <input name="userId" type="hidden" value={user.id} />
                  <input name="disabled" type="hidden" value={user.disabledAt ? "false" : "true"} />
                  <button className="btn-secondary w-full" type="submit">
                    {user.disabledAt ? "Enable" : "Disable"}
                  </button>
                </form>
                <form
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2"
                  action={resetUserPassword}
                >
                  <input name="userId" type="hidden" value={user.id} />
                  <input
                    className="field min-h-11 py-2 text-sm"
                    name="password"
                    type="password"
                    placeholder="New password"
                    minLength={8}
                    required
                  />
                  <button className="btn-secondary" type="submit">
                    Reset
                  </button>
                </form>
                <form action={deleteUser}>
                  <input name="userId" type="hidden" value={user.id} />
                  <button
                    className="btn-danger w-full"
                    disabled={user.trips.length > 0}
                    type="submit"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
            {user.trips.length > 0 ? (
              <div className="mt-4 grid gap-3 border-t border-line pt-4">
                <p className="text-sm text-coral">
                  Transfer {user.trips.length} owned trip(s) before deleting this account.
                </p>
                {user.trips.map((trip) => (
                  <form
                    action={transferTripOwnership}
                    className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                    key={trip.id}
                  >
                    <input name="tripId" type="hidden" value={trip.id} />
                    <input name="expectedOwnerId" type="hidden" value={user.id} />
                    <p className="self-center break-words text-sm font-semibold text-ink">
                      {trip.name}
                    </p>
                    <select className="field" name="replacementOwnerId" required>
                      <option value="">Choose replacement owner</option>
                      {replacementOwners
                        .filter((replacement) => replacement.id !== user.id)
                        .map((replacement) => (
                          <option key={replacement.id} value={replacement.id}>
                            {replacement.username} ({replacement.email})
                          </option>
                        ))}
                    </select>
                    <button className="btn-secondary" type="submit">
                      Transfer ownership
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Showing {users.length} of {total} users.
      </p>
    </AdminShell>
  );
}
