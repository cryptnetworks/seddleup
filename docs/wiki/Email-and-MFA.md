# Email and MFA

SeddleUp uses email for:

- Account verification
- Password reset links
- User and trip invitations
- Email-based two-factor codes

SMTP is optional for private testing but recommended for production. Email-code
MFA cannot be newly enabled unless SMTP delivery is configured.

## SMTP Configuration

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=no-reply@app.example.com
EMAIL_APP_NAME="SeddleUp"
PASSWORD_RESET_TOKEN_MINUTES=45
```

Use `SMTP_SECURE=false` for port `587` with STARTTLS. Use `SMTP_SECURE=true` for implicit TLS ports such as `465`.

Outbound email subjects, plain text, and HTML templates use SeddleUp branding.
Known stale legacy `EMAIL_APP_NAME` values such as `TripTally`, `Trip Tally`,
and `trip-tally` are treated as SeddleUp to avoid leaking old user-facing
branding.

## Deferred Compatibility Names

The authoritative inventory, owners, release boundaries, migration procedures,
and rollback requirements are in the
[Compatibility Name Migration Plan](Compatibility-Name-Migration-Plan).

## Email Verification

New users must verify email before login when email verification is enabled in admin settings. Tokens are random, stored only as SHA-256 hashes, expire, and are marked used after success.

## Password Reset

Password reset tokens are random, stored only as SHA-256 hashes, expire, and are single-use.

## Invitations

Invitation emails use the SeddleUp branded email template and include inviter
details plus the trip name when an invite is tied to a trip. Tokens are random,
stored only as keyed digests, expire after seven days, and can be accepted only
by the invited email address.

## MFA Options

Users can configure MFA from account settings:

- No MFA
- Email code
- Authenticator app TOTP

Email-code MFA requires `SMTP_ENABLED` to be unset or `true`, plus both
`SMTP_HOST` and `SMTP_FROM`. If SMTP is disabled or incomplete, SeddleUp blocks
new email-code MFA enablement so users do not create an undeliverable second
factor. Authenticator-app MFA remains available without SMTP.

Authenticator secrets are encrypted at rest.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
