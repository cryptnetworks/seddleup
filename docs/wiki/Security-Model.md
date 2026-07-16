# Security Model

## Sessions

- NextAuth uses JWT sessions.
- Production cookies are secure and HTTP-only where applicable.
- Protected server access validates the current session user against the database.
- Deleted or disabled users are rejected even if a stale JWT exists.
- Receipt files are stored outside public assets and served only after trip
  membership authorization.
- Payment methods store only external handles or links, never payment
  credentials.
- Recorded settlement payments are authenticated trip ledger entries, not
  processed transactions. Only the non-viewer trip member linked to the recipient
  participant may confirm receipt. Owner, trip-admin, and application-admin roles
  do not grant authority over another creditor's confirmation. Only the confirming
  creditor can edit its date/note or delete it.
- Retail lookup runs server-side so provider keys are not exposed to clients.
- Discord interactions verify request signatures before processing commands.

## Read-Only Sharing Links

- Trip owners and trip administrators can create one unlisted, read-only sharing
  link per trip. Recipients do not become members and cannot mutate data.
- The URL is a bearer credential. Anyone who receives it can view and forward the
  configured summary until it expires, is rotated, or is revoked.
- Tokens contain 256 bits of randomness. Only an HMAC-SHA-256 digest keyed by
  `TOKEN_DIGEST_SECRET` is stored; the raw URL is shown only after creation or
  rotation.
- Invalid, expired, revoked, rotated, and rate-limited links use the same
  unavailable response and reveal no trip identity.
- Anonymous lookups are throttled by a protected requester bucket. The route is
  dynamic, non-cacheable, marked `noindex`/`nofollow`, and sends `no-referrer`.
- The shared page contains only local assets and no analytics, payment links, or
  third-party resources. Cloudflare Web Analytics is confined to the public
  marketing layout.
- The default participant privacy mode uses `Traveler N` labels. Managers may
  deliberately choose initials, first names, or full names.
- Shared data excludes email addresses, account and invitation data, audit logs,
  draft expenses, notes, receipts and parser output, payment methods, and internal
  database identifiers.
- Recorded settlement payments and their private notes are also excluded from
  anonymous shared summaries.
- Creation, rotation, settings changes, and revocation are audited without the raw
  token or full sharing URL.

## OAuth

- Provider access tokens and refresh tokens are not stored.
- OAuth callback creates the NextAuth session server-side after provider state,
  PKCE, profile, account, and registration checks pass.
- Password reset, email verification, and MFA session handoff tokens are stored
  only as HMAC-SHA-256 digests keyed by `TOKEN_DIGEST_SECRET`.
- OAuth account linking requires a current app session.
- OAuth authorization state is stored only as a keyed digest, bound to the
  provider, purpose, intended linking user where applicable, and a keyed digest
  of the PKCE verifier. It expires after ten minutes and is conditionally consumed
  before an authorization code is exchanged.
- Existing accounts are not linked by email matching. New OAuth registrations
  require a provider-specific positive email-verification assertion.
- Password and sensitive authentication changes increment a per-user session
  version. JWTs with a missing or older version are rejected.

The complete initiation, callback, account-linking, session-cookie, rejection,
and compatibility-cookie sequence is documented in
[Admin and OAuth Providers](Admin-and-OAuth-Providers#supported-callback-flow).
OAuth callbacks create the NextAuth cookie directly on the server. The removed
client-visible OAuth app-login-token handoff must not be reintroduced.

## One-Time Credential Concurrency

Password-reset tokens, email-verification tokens, email MFA challenges, session
login tokens, invitations, Discord link tokens, and OAuth state all use a final
conditional database mutation that matches the credential's ID, purpose,
digest, unused state, and expiry. Exactly one request may change that state.
Password changes, email-verification changes, Discord linking, invitation
acceptance, and OAuth-state consumption keep their protected database work in
the same bounded Prisma transaction where applicable.

SQLite serializes the conditional write. Concurrent requests may both perform a
keyed digest lookup or an expensive password/code comparison, but only the
request whose conditional mutation changes one row succeeds. Replays, expiry,
revocation, purpose mismatch, and contention use the same generic invalid result.
The application does not log raw credentials or include a consumed credential
in its final redirect.

Authenticator-app TOTP is not a stored one-time credential: it follows the
standard short time-window verification model. It remains encrypted at rest and
is never logged, but a valid TOTP value can be accepted more than once during
its standards-defined window. MFA recovery uses an authorized, explicitly
confirmed admin reset that removes the encrypted secret and revokes all target
sessions and pending authentication challenges in the same transaction. The
audit event records identities and the former method, never secret material.

## CSRF

- State-changing Server Actions require `Origin` or `Referer` to prove the same
  origin. Missing, malformed, and cross-origin values fail closed.
- The custom login API rejects cross-origin posts.
- NextAuth handles CSRF for its built-in endpoints.

## Rate Limiting

- Login, registration, password reset, email verification resend, invitation
  acceptance, and admin invitation actions use rate limits.
- Login throttling stores bounded account, source, and account/source buckets in
  SQLite and fails closed if that store is unavailable. Attempts from one source
  do not immediately lock the same account out from another source.
- Forwarded source addresses are used only when `SEDDLEUP_TRUST_PROXY_HEADERS=true`.
  Enable it only behind a proxy that overwrites or safely appends those headers.
- Other lower-risk action limiters remain process-local. Multi-replica deployment
  is not supported with the current SQLite runtime model.
- An optional authenticated HTTPS store can coordinate every limiter using only
  keyed bucket digests. Its strict response boundary and explicit fail-closed or
  process-local outage behavior are documented in the
  [shared rate-limit store contract](../shared-rate-limit-store.md).

## Receipt Files

- New PDF, JPEG, PNG, HEIC, and HEIF uploads must match recognized file signatures;
  client MIME declarations alone are not trusted.
- Image bytes are not decoded by the local heuristic parser, and PDF bytes are
  treated only as bounded text input. Receipt responses are authorized, `nosniff`,
  and `private, no-store`.

## XSS

- User-controlled values are rendered as React text, not raw HTML.
- Audit metadata is rendered as text in a `pre` block.
- Login callback redirects are limited to local relative paths.
- The app sets a Content Security Policy.

## Security Headers

Configured globally:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Strict-Transport-Security`
- `Cross-Origin-Opener-Policy: same-origin`

## Public Operational Endpoints

- `/api/health/live` exposes only the service name and `live` state.
- `/api/health` exposes only `ready`, `unavailable`, and `not_checked` states for
  configuration, database connectivity, and migration readiness.
- Neither endpoint returns secrets, tokens, configuration values, private URLs,
  database contents, migration names, exception text, or filesystem paths.
- Both endpoints disable caching. Detailed authenticated/admin diagnostics are
  intentionally outside the public readiness surface.

## GitHub Actions Runner Trust

SeddleUp is public, so all pull-request code is routed to GitHub-hosted runners
and must never execute on the persistent self-hosted runner. Trusted pushes,
tags, and schedules may use the Linux x64 runner. The workflows do not use
`pull_request_target` to execute proposed code. Outside-collaborator workflow
runs require maintainer approval, including review of any workflow-file changes.
Runner labels, prerequisites, scoped cleanup, group restrictions, and the outage
fallback are documented in [Repository Automation](Repository-Automation).

## Residual Notes

The CSP permits inline scripts/styles for Next.js compatibility and the theme bootstrap script. Development mode may also require browser eval support for React diagnostics, but production should not rely on `unsafe-eval`. If strict nonce/hash CSP support is added later, this can be tightened.

## Security Testing

Automated coverage includes:

- Unit tests that verify security headers remain configured.
- Unit tests that verify user-controlled text is escaped by React rendering.
- API/session tests for stale sessions, disabled users, MFA, CSRF, and role checks.
- Unit, integration, and browser tests for sharing-token lifecycle, authorization,
  disclosure boundaries, response protections, and read-only behavior.
- GitHub Actions security workflow for high-severity npm audit, Trivy filesystem scan, and Trivy Docker image scan.
- CodeQL is expected to run through GitHub default setup in repository settings.

`npm run security:audit` currently fails high or critical advisories. The dependency tree is expected to audit cleanly; vulnerable transitive dependencies are remediated with scoped npm overrides when upstream packages lag patched versions.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
