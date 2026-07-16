# PostgreSQL Support Design

Status: design approved for future implementation; PostgreSQL is not supported
by the current release.

`DATABASE_URL` must continue to reject `postgres:` and `postgresql:` values
until every implementation gate in this document is complete. Changing URL
validation alone would select a SQLite schema, SQLite migrations, and a
`better-sqlite3` adapter against an incompatible database.

## Decision

SeddleUp will support SQLite and PostgreSQL as coexisting deployment options.
Existing SQLite installations will not be forced to migrate. A SQLite-to-
PostgreSQL move is an explicit, operator-run, one-way cutover; automatic startup
conversion and transparent failback are out of scope because dual writes would
create ledger consistency risks.

The application domain models remain engine-neutral, but each engine owns its
schema, migration history, adapter, integration tests, backup procedure, and
runtime probes. Both engines must implement the same authorization,
single-consumption credential, settlement, audit, and rate-limit invariants.

## Schema and Prisma layout

The implementation should introduce a canonical model source and generate two
reviewable Prisma schemas, or use an equivalently deterministic build step:

- `prisma/sqlite/schema.prisma` with `provider = "sqlite"` and the
  `@prisma/adapter-better-sqlite3` runtime adapter;
- `prisma/postgresql/schema.prisma` with `provider = "postgresql"` and the
  supported Prisma PostgreSQL driver adapter;
- separate `prisma/sqlite/migrations/` and `prisma/postgresql/migrations/`
  histories.

Generated schemas must be checked for drift in CI. A migration must never be
generated for one engine and copied mechanically to the other. Constraint,
index, default, timestamp, collation, text comparison, cascade, and transaction
semantics require engine-specific review.

Before implementation, audit every raw query and transaction assumption. The
current code particularly depends on SQLite behavior for serialized conditional
writes, `DatabaseSync` test utilities, database-file integrity checks, startup
path/permission handling, and disposal of test databases. Also verify unique
email and provider identifiers, case sensitivity, date precision, JSON stored as
text, `cuid()` defaults, foreign-key actions, nested writes, transaction retry
behavior, and the persistent `RateLimitBucket` concurrency contract on
PostgreSQL.

## Runtime selection and configuration

Engine selection should be explicit, for example `DATABASE_ENGINE=sqlite` or
`postgresql`, and cross-validated with `DATABASE_URL`. Inferring behavior only
from a URL makes mistakes harder to diagnose. SQLite remains the default for
backward compatibility. PostgreSQL configuration must require TLS policy and
document connection-pool sizing; production must not silently disable TLS.

The selected engine constructs exactly one matching Prisma client adapter.
Validation errors may identify the scheme or missing option but must never echo
credentials. Environment examples must show fake values only. Docker startup
must branch before SQLite path normalization: file ownership, legacy
`triptally.db` adoption, and integrity checks apply only to SQLite, while a
bounded PostgreSQL connectivity check and engine-specific migration deployment
apply to PostgreSQL.

## Migration and deployment strategy

Every release containing a model change must include reviewed migrations for
both engines. CI creates fresh databases and upgrades the previous supported
schema for each engine, runs `prisma migrate deploy`, checks migration history,
then runs integration and production smoke tests. Deployment uses expand/
contract changes where rolling compatibility matters; destructive changes need
a separate release boundary, verified backup, and explicit rollback decision.

Fresh installations select an engine, validate configuration, deploy only that
engine's complete migration chain, seed/bootstrap through the existing app
workflow, and pass readiness before serving traffic. Existing installations
back up their current engine, deploy the matching migrations, and verify schema,
health, login, trip, expense, settlement, receipt, and OAuth behavior. Startup
must fail clearly on a wrong engine, unreachable database, migration failure, or
unexpected migration history; it must never create a replacement empty database
when an expected database is invalid or inaccessible.

## SQLite data portability and cutover

Build a versioned migration utility rather than copying database files or using
`prisma db push`. It must:

1. require a stopped or read-only source and a verified SQLite backup;
2. require an empty, migrated PostgreSQL target;
3. export in dependency order with stable IDs and UTC timestamps;
4. import in bounded transactions while preserving nullable relations and
   encrypted/digested values exactly;
5. reconcile row counts and deterministic hashes for non-secret columns without
   printing private data;
6. validate foreign keys, unique constraints, settlement revisions, audit-log
   references, OAuth/account links, one-time credential state, and receipt file
   references;
7. refuse a non-empty target and support a dry run;
8. produce a redacted reconciliation report.

Receipt binaries remain in private filesystem/object storage and are not copied
through database rows. The operator must migrate them consistently with the
database and preserve paths or complete a separately tested storage migration.

Cutover is one-way: stop writes, back up SQLite and receipts, migrate, reconcile,
switch configuration, start, and run smoke tests. Rollback before any
PostgreSQL-side write restores the SQLite configuration and files. After writes
begin, rollback requires a separately implemented and tested PostgreSQL-to-
SQLite export or restoration of the pre-cutover snapshot with acknowledged loss
of later writes; changing the URL back is not safe.

## Backup, recovery, and failure handling

SQLite keeps the current stopped-copy/integrity-check procedure. PostgreSQL
documentation must define provider-appropriate logical and physical backups,
encryption, retention, point-in-time recovery where available, and a routine
restore rehearsal. Application releases must state whether their migrations are
backward compatible and identify the last safe application/database pairing.

Failed migrations leave the service unready and require operator intervention.
Do not automatically mark a migration resolved, drop a schema, fall back to
SQLite, or retry indefinitely. Recovery uses the verified backup or a reviewed
forward-fix migration and records the chosen procedure without database secrets.

## Development, deployment, and CI matrix

Local SQLite remains the zero-service default. PostgreSQL development uses a
pinned disposable container and fake credentials. Production may use a managed
service or operator-managed cluster that satisfies the documented PostgreSQL,
TLS, backup, and availability versions; the application image must not bundle a
database server.

Required CI gates before enabling PostgreSQL are:

- schema generation and validation for both engines;
- fresh migration and previous-release upgrade for both engines;
- engine-specific unit/integration tests, including concurrency and rollback
  behavior;
- the full authorization, credential-consumption, settlement, rate-limit, OAuth,
  and receipt suites against both engines where persistence matters;
- production build and E2E smoke tests for each engine;
- Docker startup/readiness, failed-connectivity, failed-migration, restart, and
  data-preservation probes;
- a SQLite-to-PostgreSQL cutover fixture with reconciliation and negative tests;
- native adapter clean-install checks on supported Node versions and Linux
  architectures.

PostgreSQL CI must use isolated ephemeral databases and must not contact shared
or production infrastructure.

## Delivery sequence and compatibility gates

Implement in independently reviewable pull requests:

1. dual schema generation and drift checks, without changing runtime support;
2. PostgreSQL adapter/config validation behind an explicit non-production test
   gate;
3. engine-specific migration history and fresh/upgrade integration tests;
4. portability utility, reconciliation, backup, rollback, and operator docs;
5. Docker/runtime probes and the complete two-engine CI matrix;
6. public configuration examples and runtime enablement.

Only the final step may accept PostgreSQL URLs in normal configuration or claim
support. Its release notes must identify the supported versions, feature parity,
known performance differences, connection limits, backup responsibility,
cutover irreversibility, and rollback boundary. Until then, SQLite remains the
only supported engine and existing `file:` behavior, migrations, legacy filename
handling, and single-container deployment remain unchanged.

## Acceptance gate

PostgreSQL support is complete only when schemas, independent migrations,
adapters, configuration validation, clean and upgraded installs, portability,
backup/restore, Docker behavior, documentation, and the full CI matrix all pass.
No individual foundation PR may relax the current PostgreSQL URL rejection.
