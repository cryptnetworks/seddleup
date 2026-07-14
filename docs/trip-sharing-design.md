# Read-Only Trip Sharing Design

## Threat Model

An unlisted trip-sharing URL is a bearer credential. Anyone who obtains it can
view the configured summary and can forward the URL. It is not equivalent to an
authenticated SeddleUp account or trip membership.

The design protects against database disclosure of usable links, accidental
indexing, referrer leakage, stale links after rotation, unauthorized management,
anonymous mutations, and high-volume token guessing. It cannot prevent an
authorized recipient from copying, photographing, or forwarding information
that the manager deliberately shared.

Controls:

- Generate 256-bit random URL-safe tokens and store only a keyed HMAC digest.
- Resolve tokens only on the server and return the same unavailable page for
  invalid, expired, and revoked links.
- Permit only trip owners and administrators to create, configure, rotate, or
  revoke a link.
- Keep the anonymous surface read-only and separate from membership access.
- Rate-limit anonymous lookups without using the raw token as a rate-limit key.
- Send `noindex`, `nofollow`, and `no-referrer` protections and render no
  third-party resources.
- Exclude raw tokens from logs, audit records, metadata, titles, and errors.

## Data Exposure Rules

The anonymous summary exposes only:

- trip name and configured date range;
- USD currency, total included cost, and included expense count;
- non-draft expense title, category, date, amount, status, and privacy-filtered
  payer label;
- privacy-filtered participant paid, owed, and net totals;
- privacy-filtered settlement names and amounts.

It never queries or renders participant email addresses, user IDs, account data,
invitations, audit logs, receipts or parser data, payment methods, internal
notes, draft expenses, or internal database identifiers. Participant labels
default to anonymized `Traveler N` values. Managers may choose first names,
initials, or full names.

## Schema And Server Design

`TripShareLink` stores one current link per trip with a unique token digest,
participant-name privacy mode, optional expiry, revocation timestamp, creation
time, update time, and creating manager. Rotation replaces the digest and resets
creation/revocation state, immediately invalidating the previous token.

Server actions under `lib/actions/trip-sharing.ts` validate form input with Zod,
require authenticated trip-manager access, and write token-free audit events.
`lib/trip-sharing.ts` owns token generation, digesting, validation, privacy-label
mapping, anonymous query selection, and summary calculation.

The anonymous route is `/share/trip/[token]`. It does not call authenticated
trip-access helpers, expose authenticated navigation, or contain mutation forms.

## User Flow

1. A trip owner or administrator opens **Share read-only summary** from the trip.
2. The manager selects participant-name privacy and an expiry window. The safe
   defaults are anonymized labels and 30 days.
3. Creating or rotating returns the full sharing URL once in the authenticated
   page state so it can be copied. The raw token is never persisted.
4. The management page shows status, creation time, expiration, privacy mode,
   and confirmation controls for rotation and revocation.
5. A recipient opens the URL and sees only the limited summary. Invalid,
   expired, revoked, and rate-limited requests reveal no trip information.
