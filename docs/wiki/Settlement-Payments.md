# Settlement Payments

SeddleUp lets the participant who is owed money confirm a completed transfer.
This is the creditor's private ledger statement; SeddleUp does not send money,
connect to a bank, or independently verify that an external transfer completed.

## Payment Methods Versus Trip Payments

- A `PaymentMethod` is a user's Venmo, PayPal, Cash App, Apple Cash, Zelle, or
  custom destination. Opening one of these links leaves SeddleUp.
- A `TripPayment` records money that the linked recipient says has already been
  transferred. It has a sender, recipient, USD amount, payment date, optional
  private note, confirming user, and confirmation timestamp.

Recording a trip payment never creates or changes an expense or expense share.

## Balance Behavior

For each participant, SeddleUp calculates:

```text
remaining = expense paid - expense owed + payments sent - payments received
```

If Alice should receive $50 and Alice confirms receiving $20 from Bob, Alice's
remaining receivable and Bob's remaining debt both become $30. Overpayment is
rejected; the confirmation can never exceed the current trusted suggestion.

The current application ledger is USD-only. Forms never accept a submitted
currency value, so a client cannot introduce a cross-currency transfer.

## Permissions

- Owners, trip administrators, and members may confirm receipt only when their
  user ID exactly matches the recipient participant's `userId`.
- Elevated roles cannot confirm, edit, or delete another creditor's statement.
- Debtors cannot clear their own balance. Names, emails, handles, and URL values
  never establish creditor identity.
- Viewers can see authenticated payment history and adjusted balances but cannot mutate it.
- Only the confirming creditor may edit the payment date or private note, or
  delete the confirmation. Changing amount or parties requires deletion and a
  new confirmation.
- Non-members and unauthenticated users have no access.

The server reloads both participants, recalculates the current settlement from
trusted expenses and prior confirmations, validates the maximum outstanding
amount, and serializes the write. Repeated, concurrent, stale, and overpayment
submissions fail without changing the ledger.

## Recording And Managing Payments

The linked creditor uses **Confirm payment received** beside a settlement
suggestion. Sender and recipient are fixed, the current remaining amount is
prefilled, and the creditor can reduce it for a partial payment. All displayed and
hidden values are validated again by the server. Other members see the suggestion
without a confirmation action.

Payment history says who confirmed receiving money from whom. It does not claim
that SeddleUp processed or independently verified a transfer. History appears
newest first on the authenticated trip dashboard.

Private payment records and notes are excluded from read-only sharing links,
public APIs, metadata, robots output, and the sitemap.
Application logs and audit snapshots exclude private payment notes.

## Migration And Rollback

Deployments must apply the bundled Prisma migrations before the new application
version starts. Docker startup runs `prisma migrate deploy` automatically. A
forward reconciliation migration preserves the merged trip schema after the
settlement and owner-protection histories meet; it resets only the internal
settlement concurrency revision while preserving trip fields and ledger rows.
Trip deletion cascades to its private ledger, while participant deletion is
restricted when a confirmation references that participant as sender or
recipient. User attribution uses `SET NULL` when an account is deleted.

Before rollback, create and validate a SQLite backup. Reverting only application
code leaves the additive table unused and preserves its data. Dropping the table
is destructive and should happen only through a separately reviewed migration.

---

[Wiki Home](Home) | [Architecture](Architecture) | [Security Model](Security-Model) | [Backups and Updates](Backups-and-Updates)
