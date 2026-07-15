# Security Policy

## Supported Versions

Security fixes are applied to the `main` branch and current Docker images published from `main`.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability.

Report privately to the repository maintainers with:

- Affected component or route
- Steps to reproduce
- Impact and expected result
- Relevant logs or screenshots with secrets removed

Maintainers will acknowledge valid reports, investigate, and coordinate a fix before public disclosure.

## Responsible Disclosure

- Do not publish exploit details before a fix is available.
- Do not access, modify, or delete data that is not yours.
- Do not run destructive tests against production deployments.
- Do not include passwords, tokens, MFA secrets, recovery codes, or session cookies in reports.

## Security Model Summary

- Provider OAuth access and refresh tokens are not stored.
- OAuth login callbacks create the NextAuth session server-side after provider
  state, PKCE, profile, account, and registration checks pass.
- Password reset, email verification, and MFA session handoff tokens are stored
  only as HMAC-SHA-256 digests keyed by `TOKEN_DIGEST_SECRET`.
- Anonymous trip-sharing tokens are 256-bit bearer credentials stored only as
  HMAC-SHA-256 digests. Links are unlisted, rate-limited, revocable, optionally
  expiring, and excluded from application logs and audit metadata.
- Protected server access validates the current session user against the database.
- Disabled or deleted users lose access on the next protected server request.
- State-changing requests include same-origin CSRF checks.
- Anonymous trip summaries are read-only and exclude emails, account data,
  drafts, notes, receipts, payment details, invitations, and audit logs.
- Structured application logging applies a final recursive redaction boundary
  for secret/token/credential key families, sensitive URL query values, bearer
  values, email addresses, database URLs, and sensitive receipt paths while
  preserving event names, timestamps, and non-sensitive record IDs.
- Production security headers include CSP, HSTS, frame denial, content-type protection, referrer policy, permissions policy, and cross-origin opener policy.

## Automated Security Checks

The repository security workflow runs high-severity npm audit, Trivy filesystem scanning, and Trivy Docker image scanning. CodeQL is expected to run through GitHub default setup in repository settings.

`npm run security:audit` is configured to fail on high and critical advisories. Current npm audit output is expected to be clean; vulnerable transitive dependencies are remediated with scoped npm overrides when upstream packages lag patched versions.

Dependabot major updates are reviewed before adoption. ESLint 10 is deferred
until the Next.js ESLint plugin chain advertises compatible peer ranges, and
Node 26 Docker images are deferred while that release is Current rather than
LTS for this stack. The app uses Node.js 24.18.0 LTS with bundled npm 11.16.0,
uses EmailJS for SMTP delivery, and does not keep a direct Nodemailer
dependency.

Redaction is defense in depth. Application code must still avoid sending raw
request bodies, authentication objects, cookies, receipt contents, or secret
values to the logger. The regression matrix and current limitations are in
[Testing and Production Readiness](docs/wiki/Testing-and-Production-Readiness.md).
