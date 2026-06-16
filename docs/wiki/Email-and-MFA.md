# Email and MFA

SeddleUp uses email for:

- Account verification
- Password reset links
- Email-based two-factor codes

SMTP is optional for private testing but recommended for production.

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

## Email Verification

New users must verify email before login when email verification is enabled in admin settings. Tokens are random, stored only as SHA-256 hashes, expire, and are marked used after success.

## Password Reset

Password reset tokens are random, stored only as SHA-256 hashes, expire, and are single-use.

## MFA Options

Users can configure MFA from account settings:

- No MFA
- Email code
- Authenticator app TOTP

Authenticator secrets are encrypted at rest.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
