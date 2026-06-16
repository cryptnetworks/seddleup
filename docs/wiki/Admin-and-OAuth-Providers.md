# Admin and OAuth Providers

The first registered user becomes the bootstrap administrator. Admin pages are available under `/admin`.

## Admin Areas

- `/admin` - overview and recent audit events
- `/admin/users` - user search, role changes, disable/enable, password reset, deletion
- `/admin/auth` - OAuth provider configuration and callback URLs
- `/admin/settings` - local auth, registration, email verification, allowed domains, default role
- `/admin/audit` - searchable audit events

## OAuth Providers

SeddleUp supports configurable OAuth login for:

- Google
- GitHub
- Discord
- Facebook

Provider client secrets are encrypted before storage with `AUTH_CONFIG_ENCRYPTION_KEY`.

## Callback URLs

Configure these with each provider:

```text
https://app.example.com/api/auth/oauth/google/callback
https://app.example.com/api/auth/oauth/github/callback
https://app.example.com/api/auth/oauth/discord/callback
https://app.example.com/api/auth/oauth/facebook/callback
```

Replace `app.example.com` with your public domain.

## Account Linking

Signed-in users can link OAuth providers from the account page. SeddleUp prevents removing the final login method for an account.

## Token Handling

SeddleUp does not store provider access or refresh tokens. OAuth login creates a local short-lived, single-use handoff token in an HTTP-only cookie. That token is consumed to create the app session and then invalidated.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
