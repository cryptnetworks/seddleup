# Compatibility Name Migration Plan

This page is the authoritative inventory and migration policy for retained
TripTally names. User-facing branding remains SeddleUp. Compatibility identifiers
must not be renamed as incidental cleanup.

## Current inventory

| Area                                   | Current occurrence                                                                           | Classification                  | Owner and decision                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Package metadata                       | `package.json` and lockfile name `triptally`                                                 | Future major release            | Maintainers may rename both together only in an isolated release with clean-install, Docker, CI, and rollback verification.         |
| Docker services and current volume     | `seddleup`, related profile containers, and `seddleup_data`                                  | Keep indefinitely               | Deployment names already use SeddleUp. Do not rename them again without an operator migration plan.                                 |
| Historical Compose volume              | `triptally_data` in migration documentation                                                  | Historical reference            | Operators may still own this external volume. Keep the warning and never delete or automatically claim it.                          |
| SQLite filename                        | Read-only adoption of `/app/data/triptally.db` when `seddleup.db` is absent                  | Keep indefinitely               | Runtime/Deployment owns this data-preservation alias. Current-file precedence and integrity validation must remain.                 |
| Docker environment aliases             | `TRIPTALLY_DOCKER`, `TRIPTALLY_SQLITE_PATH`, and `TRIPTALLY_ALLOW_INSECURE_SECRET` fallbacks | Rename with compatibility alias | `SEDDLEUP_*` remains authoritative. Remove legacy reads only in a major release after a measured deprecation period.                |
| Email app name                         | Legacy `TripTally` spellings normalized to SeddleUp                                          | Keep indefinitely               | Email owns this input normalization so stale operator configuration cannot leak old branding.                                       |
| Session cookies                        | NextAuth `next-auth.*` and `__Secure-next-auth.*` names                                      | Keep indefinitely               | No TripTally-specific session cookie remains. Renaming standard cookies would log users out and is not a branding task.             |
| OAuth transient cookies                | `oauth_state_*`, `oauth_pkce_*`, and `oauth_link_*`                                          | Keep indefinitely               | Auth owns these generic security boundaries. They carry no TripTally brand and must stay coordinated between start/callback routes. |
| Internal instrumentation flag          | `tripTallyInstrumentationStarted`                                                            | Safe isolated rename            | It is process-local and unpersisted. Rename only with instrumentation tests; it does not justify a release migration.               |
| OAuth development fixtures             | `triptally-test-client`, `triptally-test-secret`, and `triptally.test` addresses             | Safe isolated rename            | Testing owns these synthetic values. Change all providers, callbacks, and expectations together without production data changes.    |
| Test fixture/module names              | `tests/fixtures/triptally.ts`, temporary receipt paths, and generated test emails            | Safe isolated rename            | Testing owns them. Retain explicit legacy-path fixtures that prove compatibility.                                                   |
| Historical reports and migration names | Prior reports, issue notes, and immutable Prisma/Git history                                 | Historical reference            | Keep truthful history. Never edit applied migration identifiers merely to change branding.                                          |
| User-facing copy and assets            | SeddleUp                                                                                     | Keep indefinitely               | Product owns the public brand. A legacy identifier must not reappear in UI, email, metadata, or screenshots.                        |

No tracked absolute checkout path is part of the runtime contract. The repository
name, image path, nginx template, Cloudflare service example, current SQLite
filename, and current Docker identifiers already use SeddleUp.

## Future package rename

Release boundary: a reviewed major release, unless maintainers prove no external
automation consumes the private package name.

Migration procedure:

1. Change the root package name and lockfile root package name in one commit.
2. Search source, tests, workflows, Docker layers, and documentation for the old name.
3. Run a clean `npm ci`, the complete validation suite, Docker build, runtime
   probes, and optional-profile probes.
4. Publish only after repository automation and image labels have been inspected.

Rollback: revert the package-name commit and rebuild from the prior lockfile.
There is no database migration. Required coverage includes clean install,
development and production E2E, Docker build, command invocation, and release metadata.

## Legacy SQLite and volume migration

The container currently validates and moves `triptally.db` only when the current
`seddleup.db` is absent. If both files exist, `seddleup.db` remains authoritative
and the legacy file is untouched. Invalid or inaccessible files stop startup.

Operators moving from an old named volume must:

1. Stop writes and create a verified off-volume backup.
2. Inspect which volume and filename the old container actually mounts.
3. Copy data into the current `seddleup_data` volume using
   [Backups and Updates](Backups-and-Updates); never delete the source volume first.
4. Start the current image, wait for migration/readiness, and verify existing trips.
5. Retain the old volume and previous image until verification is complete.

Rollback: stop the new container, preserve its database, remount the old volume
with the recorded previous image, and verify health and existing data. Removing
the `triptally.db` adoption path would require a major release, upgrade telemetry
or an explicit operator opt-in, current/legacy/both-file/invalid-file tests, and
prominent release notes. The default recommendation is to keep it indefinitely.

## Legacy environment aliases

Current `SEDDLEUP_*` variables take precedence over legacy `TRIPTALLY_*` aliases.
A future removal must first warn only by variable name—never by value—across at
least one supported release, update all examples, and test new-only, legacy-only,
both-set, and missing-value behavior.

Rollback: deploy the previous image, which accepts both names. Removing an alias
must not coincide with database, cookie, or volume renames.

## Cookies and sessions

There is no active TripTally-prefixed cookie to migrate. If a future auth upgrade
changes standard NextAuth or OAuth transient cookie names, treat it as an auth
migration: dual-clear old/new transient cookies, document forced session expiry,
test secure and local cookie variants, and provide rollback that accepts sessions
created by the previous release where cryptographically possible.

## Required review for any rename

- Identify whether data, volumes, sessions, cookies, OAuth callbacks, scripts, or
  external automation use the name.
- Put compatibility reads before destructive cleanup and keep current names authoritative.
- Add fresh-install, upgrade, rollback, and invalid-state tests.
- Update the production and release checklists plus operator examples.
- Never combine a compatibility rename with unrelated feature work.

---

[Wiki Home](Home) | [Backups and Updates](Backups-and-Updates) | [Running with Docker](Running-with-Docker) | [Release Checklist](Release-Checklist)
