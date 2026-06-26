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
- Retail lookup runs server-side so provider keys are not exposed to clients.
- Discord interactions verify request signatures before processing commands.

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

## Residual Notes

The CSP permits inline scripts/styles for Next.js compatibility and the theme bootstrap script. Development mode may also require browser eval support for React diagnostics, but production should not rely on `unsafe-eval`. If strict nonce/hash CSP support is added later, this can be tightened.

## Security Testing

Automated coverage includes:

- Unit tests that verify security headers remain configured.
- Unit tests that verify user-controlled text is escaped by React rendering.
- API/session tests for stale sessions, disabled users, MFA, CSRF, and role checks.
- GitHub Actions security workflow for high-severity npm audit, Trivy filesystem scan, and Trivy Docker image scan.
- CodeQL is expected to run through GitHub default setup in repository settings.

`npm run security:audit` currently fails high or critical advisories. The dependency tree is expected to audit cleanly; vulnerable transitive dependencies are remediated with scoped npm overrides when upstream packages lag patched versions.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
