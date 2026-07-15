# SeddleUp Rebrand and Rename Report

## Repository Rename

- Target repository name: `seddleup`.
- Fallback name if unavailable: `seddleup-app`.
- Documentation and GitHub issue template links now use the SeddleUp project name and the expected `cryptnetworks/seddleup` advisory URL.
- The remote GitHub repository was renamed to `cryptnetworks/seddleup`.
- The local `origin` remote was updated to `https://github.com/cryptnetworks/seddleup.git`.
- If this checkout is recreated elsewhere, use:

```bash
git remote set-url origin https://github.com/cryptnetworks/seddleup.git
```

## Filesystem Rename

- Target local project directory: `SeddleUp`.
- The checkout directory was renamed from `TripTally` to `SeddleUp` during this branch work.
- No tracked source files depend on the old absolute local checkout path.

## Files Renamed

- `nginx/conf.d/triptally.conf` -> `nginx/conf.d/seddleup.conf`.

## Directories Renamed

- Local filesystem checkout directory only: `TripTally` -> `SeddleUp`.

## Remaining Legacy References

This report records the completed rebrand. The live inventory, ownership,
migration procedure, rollback procedure, and release boundary for every retained
name now live in the authoritative
[Compatibility Name Migration Plan](wiki/Compatibility-Name-Migration-Plan.md).

## Decisions

- Database schema, migration history, Prisma model names, and package identifiers remain unchanged to avoid unnecessary migration and deployment churn.
- Docker service/container/volume names, default SQLite filename, and Docker-facing environment names were updated to SeddleUp with startup compatibility for legacy SQLite and `TRIPTALLY_*` variables.
- App-facing metadata, manifest, PWA assets, email templates, page copy, wiki branding, issue templates, and launch logs were updated to SeddleUp.
- Local CI image tags, the GitHub Actions publish target, and operator documentation use the `ghcr.io/cryptnetworks/seddleup` image path.

## Required Follow-Up

- Publish the first `ghcr.io/cryptnetworks/seddleup` image from the Docker workflow before using the updated pull commands in production.
- Back up existing Docker volumes before switching from `triptally_data` to `seddleup_data`.
- Follow the compatibility plan before changing internal package names,
  environment aliases, legacy database handling, cookies, or test fixtures.
- If internal test fixtures are renamed later, update fixtures, imports, test domains, and OAuth test config together.
