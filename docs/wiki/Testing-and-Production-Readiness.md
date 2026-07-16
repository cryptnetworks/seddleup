# Testing and Production Readiness

This page is the authoritative guide for SeddleUp browser-test environments,
production-server smoke coverage, receipt fixtures, WebKit investigations, log
redaction, and post-SEO browser QA.

## Browser test commands

Install the browsers once:

```bash
npx playwright install chromium webkit
```

The standard development-server suite is:

```bash
npm run test:e2e
```

The command selects a free loopback port, creates a unique directory under
ignored `tmp/`, resets and migrates a disposable SQLite database, and uses a
separate receipt-upload directory. Playwright starts `next dev`; it does not
reuse a server already listening on port 3000. The launcher removes only its own
temporary directory after success or failure.

The bounded development-server matrix used by CI is:

```bash
npm run test:e2e:ci
```

It runs health/auth, accessibility, disabled-receipt, and focused iPhone
expense/SSO coverage in Chromium and Mobile Safari. The complete development
matrix remains available through `npm run test:e2e`; it is intentionally not a
single CI gate because long Turbopack HMR sessions can invalidate WebKit chunks.

The production-server suite is:

```bash
npm run test:e2e:production
```

It generates Prisma Client, applies all migrations to a new SQLite database,
builds with `next build`, starts `next start` on a free loopback port, polls
`/api/health` for up to 90 seconds, and runs focused Chromium smoke and SEO
tests. The smoke flow covers registration, login, a protected route, trip and
expense creation, logout, and a cross-user authorization rejection. The runner
uses safe test-only credentials, terminates its server, and removes its database
and uploads on every exit path.

To pass normal Playwright selectors or projects through the production runner:

```bash
npm run test:e2e:production -- tests/e2e/webkit-production.spec.ts --project='Mobile Safari' --repeat-each=3
```

`PLAYWRIGHT_BASE_URL` remains available for deliberate external-server testing
with direct `npx playwright test` use. Direct use is an expert path and does not
provide the disposable launcher safeguards. `PLAYWRIGHT_DATABASE_URL`,
`PLAYWRIGHT_PUBLIC_APP_URL`, `PLAYWRIGHT_RECEIPT_UPLOAD_DIR`, and
`PLAYWRIGHT_PORT` are test-runner inputs; they are not production configuration.

## Browser matrix

- CI development coverage: focused Chromium and Mobile Safari/WebKit smoke,
  accessibility, disabled-receipt, and iPhone flows.
- CI production coverage: focused Chromium smoke and SEO checks.
- Focused accessibility coverage: Chromium and Mobile Safari.
- Enabled receipt coverage: Chromium with a disposable upload directory.
- Full local matrix: Chromium, Firefox, WebKit, Mobile Chrome, and Mobile
  Safari when `npm run test:e2e` is run without project filters.

Headless WebKit on macOS follows the host keyboard-access preference and may
skip buttons during Tab traversal. The accessibility suite verifies sequential
Tab order in Chromium and explicit visible button focus in Mobile Safari while
keeping form labels, validation focus, and mobile layout checks in both.

## WebKit chunk-warning investigation

The tracked `ChunkLoadError` is an intermittent, non-failing Turbopack
development-server warning. On 2026-07-14, three repeated Mobile Safari
development runs (six authenticated expense/SSO tests) were clean. A later full
five-project development run reproduced the warning twice during the long
Mobile Safari layout flow while all 91 runnable tests passed. Both messages
named the `[turbopack]/browser/dev/hmr-client` chunk. Two subsequent CI runs of
the long Chromium/Mobile Safari development matrix reproduced HMR chunk
invalidation followed by interrupted or stalled navigation in the layout spec.
Three repeated production
Mobile Safari route runs completed without a chunk error, so the evidence
classifies the signal as development HMR invalidation rather than an application
or production chunk defect.

The mitigation is intentionally narrow: CI uses `npm run test:e2e:ci` for a
bounded development-server matrix, while the full matrix remains a documented
local command. Release-representative checks use the production runner, which
scans server output for `ChunkLoadError`, failed
chunk-load, and loading-chunk failures, while the focused WebKit spec observes
page errors and browser console errors. Real browser failures remain failures;
there is no global unhandled-rejection suppression. A broader production Mobile
Safari server-action run timed out before its first action POST when served over
local HTTP. That distinct limitation remains visible and is not classified as
the original chunk warning. Re-run both repeated commands when changing Next.js,
Turbopack, Playwright, CSP, service-worker behavior, or Mobile Safari support.

## Receipt upload coverage

Run the feature-enabled flow with:

```bash
npm run test:e2e:receipts
```

The runner enables uploads only for its child process and creates unique SQLite
and receipt directories. The deliberately small
`tests/fixtures/receipt-sample.pdf` contains synthetic merchant and total text,
not personal or production data. The test uploads and parses the fixture,
updates review fields and status, reads the protected file as its owner, and
proves unauthenticated and unrelated users cannot read the file or receipt/trip
pages. Files are served only through the authenticated receipt API, never from
`public/`. The default E2E suite separately proves the upload UI stays hidden
when the feature flag is disabled.

## Log-redaction boundary

All application logger metadata is redacted immediately before JSON
serialization. The boundary removes sensitive key families (passwords, tokens,
secrets, credentials, authorization/cookies, MFA/TOTP/recovery values, SMTP and
Discord credentials, database URLs, and sensitive receipt/file paths), scrubs
secret URL query parameters and bearer values, and removes email addresses from
free text. Nested objects and arrays are covered. Event names, timestamps,
non-sensitive user/trip/expense IDs, counts, booleans, and operational step
names remain available.

Redaction is defense in depth, not permission to pass raw request bodies or
secret objects to the logger. Call sites must continue to log allowlisted
operational context only. Tests use named synthetic fixtures and never include
raw fixture values in assertion-failure messages.

## SEO and responsive production QA

`tests/e2e/seo-production.spec.ts` runs against `next start` with a configured
HTTPS public origin while the browser connects to an isolated loopback server.
It checks:

- 320, 360, 375, 390, 430, 768, and 1280 pixel widths without page-level
  horizontal overflow;
- canonical, Open Graph, Twitter, JSON-LD, one-H1 and heading-order output;
- sitemap, robots, manifest availability, private-page robots metadata, and
  security response headers; and
- use of the configured HTTPS public origin instead of a localhost canonical.

Enabled receipt coverage also edits itemized receipt data, assigns a trip
participant, verifies the calculated split preview, and saves the receipt into
the expense ledger. Line-item totals plus tax, tip, and non-negative adjustments
are allocated in integer cents with any one-cent remainder assigned
deterministically in participant order. Every item must have at least one
same-trip participant; unselected participants are excluded from that item.

Saving a receipt as `Ready` creates one linked expense. Repeated submissions
update that expense and replace its reconciled shares atomically instead of
creating duplicate charges. A stale review is rejected after any intervening
line-item mutation. For itemized review, changed totals must first be saved as
`Needs review`; this refreshes the server-derived preview before the user can
promote the receipt to `Ready`. Needs-review saves do not affect the ledger. The
existing simple split remains available and
allocates the reviewed total equally across all trip participants. The enabled
browser suite exercises creation, retry idempotency, private file access,
unrelated-user rejection, and 320-pixel overflow behavior with disposable data.

Playwright keeps screenshots and video only for failed attempts. Do not commit
generated `test-results/` artifacts. A manual in-app visual pass is useful when
a browser backend is available, but it does not replace the repeatable checks.

## Local and Docker SQLite paths

Local browser launchers always override an inherited `.env` Docker URL with
their own disposable `file:` URL. This prevents a local test from attempting to
open `/app/data/seddleup.db` or silently attaching to a developer server. Normal
local development continues to use the explicitly configured local `file:` URL.

The production container remains unchanged: it requires an absolute
`file:/app/data/seddleup.db`, validates an existing file before migration, and
adopts a valid legacy `/app/data/triptally.db` only when the current filename is
absent. Browser tests never access Docker volumes or operator databases. Use
`npm run test:docker` for the disposable Docker migration, restart,
preservation, legacy adoption, corrupt/inaccessible file, and failed-migration
probes.

## Data-integrity regression suite

The ordinary unit/integration command includes server-side money boundaries,
participant and owner foreign-key restrictions, receipt cleanup compensation,
and concurrent one-time credential consumption. The development E2E suite adds
direct expense-input manipulation, participant deletion, multi-trip ownership
transfer, and authentication callback coverage. The enabled receipt runner adds
individual receipt and parent-trip directory cleanup under an isolated upload
root.

All of these launchers use disposable SQLite files. The receipt runner also
uses a disposable upload directory. They must never be pointed at a developer
or operator database or receipt directory. The detailed acceptance and rollback
ledger is maintained in
[`../data-integrity-hardening.md`](../data-integrity-hardening.md).

---

[Wiki Home](Home) | [Repository Automation](Repository-Automation) | [Running with Docker](Running-with-Docker) | [Troubleshooting](Troubleshooting)
