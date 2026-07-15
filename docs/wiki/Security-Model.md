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
- The shared page contains only local assets and no payment links or third-party
  resources.
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

## CSRF

- State-changing Server Actions enforce same-origin checks using `Origin` or `Referer` when present.
- The custom login API rejects cross-origin posts.
- NextAuth handles CSRF for its built-in endpoints.

## Rate Limiting

- Login, registration, password reset, email verification resend, invitation
  acceptance, and admin invitation actions use rate limits.
- The current limiter stores buckets in process memory. It resets on process
  restart and is not shared across app replicas.
- Single-container deployments get basic abuse throttling from the built-in
  limiter.
- Multi-replica production deployments should add shared rate limiting at the
  reverse proxy, load balancer, edge, or platform layer until a shared store such
  as Redis is implemented in the app.

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
