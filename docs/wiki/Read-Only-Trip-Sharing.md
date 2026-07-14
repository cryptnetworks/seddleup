# Read-Only Trip Sharing

Trip owners and trip administrators can share an intentionally limited cost
summary with people who do not have SeddleUp accounts.

## Create A Link

1. Open the trip.
2. Select **Share read-only summary**.
3. Choose how participant names should appear. **Anonymized labels** is the safest
   default; initials, first names, and full names disclose progressively more.
4. Choose 7, 30, or 90 days, or explicitly choose no expiration.
5. Select **Create read-only sharing link** and copy the URL immediately.

SeddleUp stores only a protected digest, so it cannot show the full URL again.
Anyone with the URL can view and forward it. Treat it like a bearer credential,
not like a private invitation tied to one person.

## What Recipients See

- Trip name, configured dates, and USD currency
- Total included cost
- Non-draft expense titles, categories, dates, amounts, statuses, and
  privacy-filtered payer labels
- Privacy-filtered participant paid, owed, and net totals
- Settlement names and amounts using the selected privacy mode

Recipients do not see emails, user or participant identifiers, invitations,
account state, audit events, draft expenses, notes, receipts, receipt parser data,
or payment handles and links. The page has no editing controls.

## Change Or Disable Sharing

The management page shows whether the link is active, expired, or revoked, plus
its creation and expiration dates.

- **Save sharing settings** changes the privacy mode or replaces the expiration
  with a new period from the current time. The URL remains the same.
- **Rotate and invalidate current link** creates a new URL and immediately makes
  the old URL unavailable. Copy the new URL when it appears.
- **Revoke sharing link** immediately makes the current URL unavailable.

Invalid, expired, rotated, revoked, and temporarily rate-limited links all show
the same unavailable page, so anonymous visitors cannot use error differences to
discover trips.

## Operational Notes

The database migration adds `trip_share_links`; container startup applies it with
the other Prisma migrations. Back up SQLite before upgrading. Rolling application
code back to a version without this feature leaves the added table unused; restore
the pre-upgrade backup only if the whole database migration must also be reversed.

---

[Wiki Home](Home) | [Security Model](Security-Model) | [Architecture](Architecture) | [Backups and Updates](Backups-and-Updates)
