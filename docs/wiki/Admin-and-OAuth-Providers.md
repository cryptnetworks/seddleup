# Admin and OAuth Providers

The first registered user becomes the bootstrap administrator. Admin pages are available under `/admin`.

## Admin Areas

- `/admin` - overview and recent audit events
- `/admin/users` - user search, invitations, role changes, disable/enable, password reset, deletion
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

## User Invitations

Admins can invite new users from `/admin/users`. Pending invitations show on the
same page and can be resent or revoked. SeddleUp stores only a keyed digest of
the invitation token; the raw token appears only in the emailed acceptance link.

Invitation acceptance lets a new user create an account or lets an existing user
sign in and accept. Admin-created invitations can assign the normal `user` or
`readonly` role.

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

Linking state is single-use and stored server-side with its provider, purpose,
PKCE verifier digest, and intended user. The callback also requires the same
live, non-disabled app session. A login-purpose state cannot authorize linking,
and a client cookie cannot select the target account.

SeddleUp never attaches a provider identity to an existing account solely by
matching email. Sign in to that existing account and link the provider explicitly.
New OAuth registration requires provider-specific positive email verification:
Google uses `email_verified`, Discord uses `verified`, and GitHub uses the primary
verified address from the email API. Facebook's profile response does not provide
an equivalent assertion in the current integration, so it may be linked by an
authenticated user but cannot bootstrap a new account.

## Token Handling

SeddleUp does not store provider access or refresh tokens. OAuth login callbacks
create the NextAuth session server-side after provider state, PKCE, profile,
account, and registration checks pass.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
