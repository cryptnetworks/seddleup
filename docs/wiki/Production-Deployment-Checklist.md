# Production Deployment Checklist

This is the authoritative go-live checklist for a SeddleUp deployment. Detailed
commands and recovery procedures remain in the linked runbooks.

## Required preflight

- [ ] Record the intended image tag and digest. Avoid an unrecorded `latest`
      deployment so rollback has a known artifact.
- [ ] Confirm Docker Engine and the Compose plugin are available. Source builds
      use Node.js 24.18.0 and npm 11.16.0 as documented in
      [Repository Automation](Repository-Automation).
- [ ] Choose exactly one public profile: [Cloudflare Tunnel](Cloudflare-Tunnel-Deployment)
      or [nginx and Let's Encrypt](Nginx-and-Lets-Encrypt-Deployment). Running only
      the private app container is supported when another trusted proxy publishes it.
- [ ] Copy `.env.docker.example` to the deployment host's protected `.env` and
      complete every required value in [Configuration](Configuration).
- [ ] Generate separate random values for `NEXTAUTH_SECRET`,
      `TOKEN_DIGEST_SECRET`, and `AUTH_CONFIG_ENCRYPTION_KEY`. Store the encryption
      key in the backup system; do not put any secret in source control or tickets.
- [ ] Set `NEXTAUTH_URL`, `AUTH_URL`, `PUBLIC_APP_URL`, and `APP_BASE_URL` to the
      final HTTPS origin. Register the exact provider callback URLs from
      [Admin and OAuth Providers](Admin-and-OAuth-Providers).
- [ ] Confirm the persistent volume mounts at `/app/data`, is writable by the
      non-root container user, and uses `file:/app/data/seddleup.db`.
- [ ] Create and verify an off-volume SQLite backup. Rehearse the restore and
      record the rollback filename by following [Backups and Updates](Backups-and-Updates).
- [ ] Review bundled Prisma migrations and run the disposable runtime probes.
      Startup must stop on an invalid database or failed migration; it must never be
      made to continue by deleting the expected database.

## Required deployment validation

Run against source and disposable Docker resources, never against the deployment
volume:

```bash
npm run validate:config
npm run docs:check
docker build -t seddleup:ci .
npm run test:docker
npm run test:docker:profiles
```

The profile probe uses fake configuration, disabled networking, temporary
certificates, and labeled disposable containers. It does not register Discord
commands, request certificates, or contact Cloudflare.

## Authentication and application readiness

- [ ] Decide whether public registration and email verification should be
      enabled before users arrive.
- [ ] Configure SMTP and verify delivery for registration, password reset, and
      invitations before enabling email-code MFA. Authenticator-app MFA does not
      require SMTP; recovery limitations are documented in [Email and MFA](Email-and-MFA).
- [ ] Register the first account through the intended public origin. The first
      registered account becomes the bootstrap administrator; verify `/admin`
      access before inviting other users.
- [ ] If Discord is enabled, configure its public interactions URL and run
      command registration deliberately with real credentials only after the app is
      healthy. The CI probe intentionally proves only the credential-free failure path.
- [ ] Verify liveness at `/api/health/live` and readiness at `/api/health`.
      Readiness must report the database and bundled migrations as available.
- [ ] Sign in, open a protected route, create a disposable trip and expense,
      edit the expense, log out, and confirm an unrelated account cannot open the trip.
- [ ] If receipts are enabled, upload a non-sensitive test receipt, review it,
      confirm authenticated download, and remove the test data according to policy.

## Proxy, TLS, and public checks

- [ ] Confirm TLS is valid and HTTP redirects to HTTPS.
- [ ] Confirm the proxy preserves `Host`, client forwarding headers, and
      `X-Forwarded-Proto: https`. Do not publish the app directly over plain HTTP.
- [ ] Verify canonical metadata, `/robots.txt`, `/sitemap.xml`, and the manifest
      use the final HTTPS origin. Follow the production procedure in
      [Testing and Production Readiness](Testing-and-Production-Readiness).
- [ ] Confirm security headers remain present through the proxy and that
      `/_next/static/*` assets load without errors.

## Rollback readiness

- [ ] Keep the previous image tag or digest and the pre-deployment database
      backup until post-deployment verification is complete.
- [ ] Define rollback triggers: failed readiness, failed migrations, missing
      existing data, authentication failure, repeated server errors, or broken
      static assets.
- [ ] If rollback is required, stop writes, preserve the failed database, restore
      the verified backup when schema state requires it, and recreate the container
      from the recorded previous image. Re-run health, login, and existing-trip checks.

---

[Wiki Home](Home) | [Release Checklist](Release-Checklist) | [Backups and Updates](Backups-and-Updates) | [Troubleshooting](Troubleshooting)
