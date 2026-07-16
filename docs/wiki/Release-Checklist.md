# Release Checklist

This is the authoritative maintainer checklist for publishing a SeddleUp release.
Deployment preparation is tracked separately in the
[Production Deployment Checklist](Production-Deployment-Checklist).

## Select the release

- [ ] Start from a clean working tree on the intended release commit from
      `main`. Record the full commit SHA.
- [ ] Choose a semantic `vX.Y.Z` tag consistent with the repository's existing
      release workflow. Do not invent a tag until the included changes and migration
      impact have been reviewed.
- [ ] Prepare release notes covering user-visible changes, security impact,
      database migrations, configuration changes, compatibility notes, and known
      limitations. GitHub can generate a draft from merged pull requests, but a
      maintainer must verify it.
- [ ] Review dependency and Dependabot changes, package-lock modifications,
      base-image changes, and deferred major-runtime decisions.

## Validate the candidate

Use Node.js 24.18.0 and npm 11.16.0. Follow
[Testing and Production Readiness](Testing-and-Production-Readiness) for browser
environment details.

```bash
npm ci
npm run validate:config
npx prisma validate
npm run docs:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:e2e:production
npm run test:e2e:receipts
npm run build
npm run security:audit
docker build -t seddleup:ci .
npm run test:docker
npm run test:docker:profiles
```

- [ ] Record each result. A skipped or unavailable check is not a pass; document
      the exact limitation and risk.
- [ ] Review every new Prisma migration against a fresh SQLite database and a
      representative upgraded backup. Confirm backup and rollback procedures before
      publishing an image that can apply it.
- [ ] Confirm the production E2E suite uses `next start`, a disposable database,
      migrations, readiness polling, and cleanup.
- [ ] Confirm optional-profile probes remain credential-free and make no live
      Discord, Cloudflare, DNS, or certificate requests.

## Review GitHub gates

- [ ] Require the CI, Documentation, Dependency Review, Security, CodeQL, Docker
      runtime/profile probe, and architecture image-build checks that apply to the
      candidate.
- [ ] Confirm Trivy filesystem and image scans pass at the configured severity.
- [ ] Confirm the Docker workflow builds both `linux/amd64` and `linux/arm64/v8`.
      Local single-architecture builds do not replace this check.
- [ ] Review the generated image metadata and ensure publication will target
      `ghcr.io/cryptnetworks/seddleup`.
      Confirm equivalent tags target the configured Docker Hub `seddleup` repository.

## Publish

- [ ] Create the reviewed `vX.Y.Z` tag on the recorded commit and push that tag.
- [ ] Watch the Release workflow create the GitHub release and the Docker Image
      workflow publish architecture digests and the multi-platform manifest.
- [ ] Record the published image digest. Verify the tag and digest refer to the
      intended commit before any production rollout.
- [ ] Do not delete or retarget a published tag to repair a bad release. Publish
      a corrective release and preserve the audit trail.

## Post-release smoke and rollback

- [ ] Deploy by following the [Production Deployment Checklist](Production-Deployment-Checklist).
- [ ] Verify liveness, readiness, login, logout, protected-route access, trip
      creation, expense creation and editing, and receipt upload/review when enabled.
- [ ] Verify canonical metadata, robots, sitemap, and manifest at the real HTTPS origin.
- [ ] Inspect startup and application logs for errors without copying secrets,
      tokens, receipt data, or sensitive paths into release notes.
- [ ] Roll back on failed readiness or migrations, missing existing data,
      authentication regressions, authorization failures, or sustained server errors.
      Use the recorded previous image and verified database backup; preserve the
      failed state for investigation.
- [ ] Link the release from completed issues and perform PR/branch housekeeping
      only after the release is verified. Do not close partially delivered issues.

---

[Wiki Home](Home) | [Production Deployment Checklist](Production-Deployment-Checklist) | [Repository Automation](Repository-Automation) | [Backups and Updates](Backups-and-Updates)
