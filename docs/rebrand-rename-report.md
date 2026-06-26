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

These references are intentionally retained because they are technical identifiers, deployment compatibility points, or test-only fixtures:

| Reference                                                                          | Classification                  | Decision                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` and `package-lock.json` package name: `triptally`                   | Should remain for compatibility | Avoids package/lockfile churn during a brand-only release.                                                                                       |
| Docker service, container, and volume names                                        | Renamed now                     | Compose now uses `seddleup`, `seddleup-nginx`, `seddleup-certbot`, `seddleup-cloudflared`, and `seddleup_data`.                                  |
| SQLite database filename                                                           | Renamed with migration fallback | New Docker defaults use `/app/data/seddleup.db`; startup moves `/app/data/triptally.db` to the new path when present and the new file is absent. |
| Environment variables with `TRIPTALLY_` prefixes used by Docker startup validation | Renamed with aliases            | New Docker config uses `SEDDLEUP_*`; the entrypoint still accepts legacy `TRIPTALLY_*` values as fallbacks.                                      |
| Test hostnames, emails, fixture filenames, and secrets such as `triptally.test`    | Safe to rename later            | Not user-facing, but broad test updates should be isolated from the rebrand.                                                                     |
| Nginx and Cloudflare internal service examples                                     | Renamed now                     | Reverse proxy and tunnel examples now target `http://seddleup:3000`.                                                                             |
| Historical running-issues entries that quote past verification commands            | Should remain for audit history | These are historical notes, not current branding.                                                                                                |
| Git history/log entries under `.git`                                               | Should remain                   | Git logs are immutable historical metadata.                                                                                                      |

## Decisions

- Database schema, migration history, Prisma model names, and package identifiers remain unchanged to avoid unnecessary migration and deployment churn.
- Docker service/container/volume names, default SQLite filename, and Docker-facing environment names were updated to SeddleUp with startup compatibility for legacy SQLite and `TRIPTALLY_*` variables.
- App-facing metadata, manifest, PWA assets, email templates, page copy, wiki branding, issue templates, and launch logs were updated to SeddleUp.
- Local CI image tags, the GitHub Actions publish target, and operator documentation use the `ghcr.io/cryptnetworks/seddleup` image path.

## Required Follow-Up

- Publish the first `ghcr.io/cryptnetworks/seddleup` image from the Docker workflow before using the updated pull commands in production.
- Back up existing Docker volumes before switching from `triptally_data` to `seddleup_data`.
- Consider a future major-version migration if internal package names, the OAuth cookie name, or test fixtures need to move from `triptally` to `seddleup`.
- If internal test fixtures are renamed later, update fixtures, imports, test domains, and OAuth test config together.
