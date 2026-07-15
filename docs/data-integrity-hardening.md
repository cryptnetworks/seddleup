# Data Integrity Hardening

This document is the implementation and verification ledger for issues #97,
#98, #99, #100, and #102. The batch starts from `origin/main` commit
`1ae3411a989ccf0b17f3972924907750e1c9b3cf`.

Issue #101 is intentionally excluded. Settlement payments are also not present
on this base: draft PR #105 targets `develop` and must be reviewed and merged
independently. This batch does not copy or depend on that feature branch.

## Acceptance matrix

| Issue | Acceptance criterion                                                                            | Planned implementation                                                                                                                                                                                         | Verification                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| #100  | Reject invalid expense precision and manipulated monetary input                                 | One reusable USD input parser returns canonical minor units and Prisma-safe decimal strings; expense create and edit use it server-side                                                                        | Unit boundaries plus direct action and integration coverage                                                            |
| #100  | Validate receipt subtotal, tax, tip, and total consistently                                     | Optional receipt-money schema rejects malformed, negative, non-finite, exponent, excessive-precision, and over-limit values while preserving blanks as `null`                                                  | Unit and direct action tests, enabled receipt E2E                                                                      |
| #100  | Keep expenses and generated shares reconciled to cents                                          | Equal-share allocation operates on integer cents and persists canonical decimal strings                                                                                                                        | Unit and integration reconciliation assertions                                                                         |
| #100  | Preserve comma-decimal input and existing records                                               | A single comma is accepted as the decimal separator; storage remains Prisma `Decimal` without rewriting existing rows                                                                                          | Unit input matrix and render/build regression checks                                                                   |
| #100  | Document the USD-only policy                                                                    | Architecture and testing/operator documentation identify the two-decimal USD boundary                                                                                                                          | Documentation review and link checks where available                                                                   |
| #97   | Never silently cascade financial history when deleting a participant                            | Server action counts payer, share, and receipt-line assignment dependencies before deletion; database relations move from cascade to restrict where required                                                   | Integration tests for an unreferenced participant and each present dependency; fresh and upgraded migration validation |
| #97   | Explain blocked deletion in the UI                                                              | Participant edit page shows dependency-aware wording and safe error states                                                                                                                                     | Component/browser assertions                                                                                           |
| #97   | Handle settlement sender and recipient dependencies                                             | Do not duplicate draft PR #105. Its migration already proposes restrictive payment foreign keys; this criterion remains dependent on settlement code landing on `main`                                         | Re-evaluate after #105 is merged; use `Related to #97` until payment coverage exists on the PR base                    |
| #99   | Compensate failed uploads                                                                       | Remove only the newly created receipt directory when parsing or persistence fails                                                                                                                              | Temporary-directory unit tests and enabled receipt failure coverage                                                    |
| #99   | Safely and idempotently remove stored receipt data                                              | A containment-checked helper validates the expected receipt directory before recursive removal and tolerates absence                                                                                           | Traversal, mismatched-path, symlink, and repeated-delete tests                                                         |
| #99   | Cover receipt, expense, trip, and user deletion behavior                                        | Individual receipt deletion removes its directory; expense deletion preserves detached receipts; trip/user deletion snapshots affected receipt paths before the database transaction and cleans them afterward | Focused action/integration tests and disposable Docker receipt-volume probe                                            |
| #99   | Make post-database cleanup failures actionable                                                  | Redacted operator events contain record IDs and operation context, never filenames, contents, or stored paths                                                                                                  | Logger assertions and failure-injection tests                                                                          |
| #102  | Block unsafe account deletion and preserve owned trips                                          | Admin deletion counts owned trips and returns a stable user-facing error instead of attempting a destructive delete                                                                                            | Integration and E2E coverage for owner and non-owner users                                                             |
| #102  | Transfer ownership explicitly and atomically                                                    | Admin-only action validates an active replacement user, updates `Trip.ownerId`, promotes the replacement membership, and demotes the previous owner membership in one transaction                              | Authorization, disabled-user, membership, rollback, and audit tests                                                    |
| #102  | Preserve account-history and final-admin safeguards                                             | Existing nullable audit attribution and participant links remain; deletion cleans receipt storage after success and retains self/final-admin protections                                                       | Integration and E2E coverage for ordinary users, admins, final admin, and deleted versus disabled behavior             |
| #98   | Make reset, verification, email MFA, and session login credentials single-use under concurrency | Conditional `updateMany` consumption matches ID, purpose, unused state, and expiry; protected state changes share the transaction where required                                                               | Concurrent SQLite integration tests require exactly one success per credential                                         |
| #98   | Preserve password/token atomicity                                                               | Password reset consumes the token and updates the password inside one bounded interactive transaction                                                                                                          | Concurrency test with different candidate passwords plus rollback injection                                            |
| #98   | Audit invitation, OAuth, and Discord one-time flows                                             | Preserve invitation's conditional acceptance; add conditional Discord consumption; persist only a digest of OAuth state and consume it before callback exchange                                                | Focused invitation, OAuth state, and Discord replay tests                                                              |
| #98   | Keep failures generic and credentials private                                                   | Known contention/replay states map to ordinary invalid results; logs contain only event and safe IDs                                                                                                           | Unit/integration assertions and the existing redaction suite                                                           |

## Ordering and dependency decisions

Implementation follows `#100 -> #97 -> #99 -> #102 -> #98`. Currency parsing
is independent and becomes the shared financial boundary. Participant deletion
then establishes a restrictive policy before the deletion and cleanup work.
Receipt cleanup is available to the user-deletion workflow. Authentication
concurrency changes come last because they require a dedicated security review
and the broadest regression run.

The #97 payment-specific acceptance criterion cannot be demonstrated on this
branch while #105 remains unmerged and based on `develop`. The current financial
relations will still be protected now, and the issue will not be claimed as
fully closed unless settlement payment coverage becomes available on `main`
before publication.

## Safety boundaries

- Tests use only disposable SQLite files and temporary receipt directories.
- Existing databases, uploads, Docker volumes, and containers are never reused.
- No raw credential, receipt content, original filename, stored path, database
  URL, or private user data is written to logs or audit metadata.
- Filesystem cleanup is compensating work around committed database operations;
  it is not represented as a cross-resource atomic transaction.
- Existing migrations remain immutable. Any relation or OAuth-state change uses
  a forward-only migration and is tested from both a fresh database and a copy
  of the pre-change schema.
