# Architecture

## Runtime

- Next.js App Router
- React and TypeScript
- Prisma ORM
- SQLite only; Postgres is not supported until a future schema and migration plan
  explicitly adds it
- NextAuth credentials sessions
- Docker startup entrypoint for validation and migrations

## Docker Runtime Flow

1. Container starts as the `nextjs` user.
2. Entrypoint normalizes `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and `TOKEN_DIGEST_SECRET`.
3. SQLite path is forced into `/app/data` for Docker persistence when needed.
4. The data directory must be writable. Existing current or legacy database
   files must be regular, readable, writable SQLite files that pass
   `PRAGMA quick_check`.
5. A validated legacy `triptally.db` is moved only when `seddleup.db` is absent.
6. Prisma Client is generated.
7. Configuration is validated.
8. Prisma migrations are applied with bounded retries. A failure prevents the
   application server and health endpoint from starting.
9. Next.js production server starts.

The Docker workflow exercises this flow with disposable volumes, including
fresh and already-migrated databases, preserved records, legacy adoption, and
negative startup cases. The runtime remains single-container SQLite and the
container remains non-root.

## Runtime Health Signals

- `GET /api/health/live` is dependency-free liveness. It proves only that the
  Next.js process is responding.
- `GET /api/health` is readiness. It validates configuration through the shared
  Zod schema, queries SQLite, compares successful Prisma migration records with
  the bundled migration directories, and rejects unfinished migrations.
- The Docker and Compose health checks use readiness so dependent services do
  not start against an invalid configuration or incomplete database.
- Public responses contain only coarse check states. Detailed exception text,
  configuration values, database paths, and migration names remain server-side
  and are not logged by the readiness route.

## Data Model

Main entities:

- `User`
- `Trip`
- `TripMember`
- `Participant`
- `Expense`
- `ExpenseShare`
- `PaymentMethod`
- `Receipt`
- `ReceiptLineItem`
- `RetailerLookupCache`
- `DiscordAccount`
- `DiscordLinkToken`
- `PasswordResetToken`
- `EmailVerificationToken`
- `Invitation`
- `TwoFactorChallenge`
- `UserAuthAccount`
- `AuthProviderConfig`
- `AuditLog`
- `TripShareLink`

## Core Application Areas

- `app/(auth)` - login, registration, verification, password reset pages
- `app/dashboard` - trip overview
- `app/trips` - trip, participant, and expense workflows
- `app/account` - profile, password, MFA, linked providers
- `app/admin` - users, auth providers, settings, audit logs
- `app/api/auth` - NextAuth, custom login, OAuth start/callback
- `lib/actions` - server actions grouped by domain
- `lib/auth.ts` - NextAuth options and credential flow
- `lib/invitations.ts` - invitation token creation, resend/revoke, and acceptance
- `lib/trip-access.ts` - trip membership lookup and manager enforcement
- `lib/trip-permissions.ts` - pure permission and expense status rules
- `lib/receipts` - local receipt storage, parsing, and itemized split helpers
- `lib/item-lookup` - retailer lookup provider abstraction and cache-backed service
- `lib/discord` - Discord request verification and account linking helpers
- `lib/validation.ts` - Zod schemas and form helpers
- `lib/calculations.ts` - expense/balance calculations
- `lib/trip-sharing.ts` - bearer-token validation, privacy labels, and safe
  anonymous summary projection

## Visual Design System

The shared light and dark themes live in `app/globals.css`. Components should use
semantic tokens (`background`, `surface`, `elevated`, `inset`, `ink`, `muted`,
`line`, `primary`, `success`, `warning`, `danger`, and `focus`) instead of raw
palette utilities. Compatibility aliases such as `ocean` and `coral` remain for
older component call sites, but resolve to the semantic primary and danger colors.

Authenticated pages use solid warm-neutral surfaces, quiet borders, and a small
shared card shadow. Status messages use the shared `status-success`,
`status-warning`, `status-danger`, or `status-neutral` treatments so their meaning
is carried by text as well as color. Buttons, fields, focus rings, disabled states,
autofill, and reduced-motion behavior are also centralized in the global theme.

`BrandLogo` switches between the checked-in light and dark logo files. Those assets
retain their original blue artwork; changing the logo palette requires a separate,
intentional brand-asset update rather than a CSS filter or automatic recoloring.

## Read-Only Trip Sharing

Each trip may have one current `TripShareLink`. The database stores a keyed token
digest, privacy mode, optional expiration, revocation state, and creating manager;
it never stores the raw bearer token. Rotation replaces the digest and immediately
invalidates the old URL.

The `/share/trip/[token]` route resolves the digest server-side and queries a
minimal trip projection. It reuses `calculateBalances`, excludes drafts, strips
internal identifiers before rendering, and does not use authenticated membership
as an anonymous-access shortcut. All management remains in authenticated server
actions under `lib/actions/trip-sharing.ts`.

## Collaborative Expense Model

Trips have explicit memberships in `TripMember`. The trip owner is also recorded
as an `owner` member for consistent access checks. Participant records may link
to app users through `Participant.userId`; when a manager adds a participant
whose email matches an account, that user is added as a trip member.
When the email does not match an account, SeddleUp creates a pending invitation
for that email and trip. Accepting it links matching participant records and
creates the trip membership.

Expenses track `createdByUserId`, `paidByUserId`, `updatedByUserId`, and
`status`. Draft expenses are private to the creator and managers and are not
included in balances. Submitted, approved, disputed, and settled expenses are
included in balances. Settled expenses are locked from normal edits and deletes.

Trip, participant, and expense changes write trip-scoped audit log rows with
before/after JSON where practical.

## Expansion Services

Payment methods store only provider labels, handles, links, visibility, and
notes. They are shown only inside authenticated trip settlement views.

Receipts are stored on the local filesystem, not in public assets. Database rows
track file metadata, parser output, raw extracted text, normalized totals, and
line items. File download routes enforce trip membership.

Retail item lookup is provider-based. The mock provider supports development and
tests; real retailers should be added only through official or affiliate APIs.
Lookup results are cached in `RetailerLookupCache`.

Discord uses the HTTP interactions model. The app verifies Discord signatures,
supports private `/link` account linking, and handles basic trip commands for
linked users.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
