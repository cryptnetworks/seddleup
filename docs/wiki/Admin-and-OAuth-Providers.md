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

## Supported Callback Flow

The supported flow stays on the server except for the provider redirects:

1. A browser requests `/api/auth/oauth/{provider}/start`. The server loads the
   enabled provider configuration, generates an opaque state value and PKCE
   verifier, and stores keyed digests of both in a ten-minute, single-use
   `OAuthStateCredential`. Login state has no user ID. Link state is accepted
   only for a same-origin request with a current verified, enabled session and is
   bound to that user ID.
2. The start route redirects to the provider with the public callback URL,
   state, and S256 PKCE challenge. HTTP-only, SameSite=Lax
   `oauth_state_{provider}` and `oauth_pkce_{provider}` cookies carry the opaque
   browser values for the callback. These generic cookie names are intentional
   compatibility surfaces and are not branding leftovers.
3. `/api/auth/oauth/{provider}/callback` requires the authorization code, state,
   both cookies, a constant-time state match, and successful atomic consumption
   of the server-side record for the same provider and PKCE verifier. Callback
   processing clears both transient cookies on every app redirect.
4. The server exchanges the code with the verifier, loads the provider profile,
   and applies provider-specific verified-email rules. An existing provider
   account may sign in. A new account may be registered only when public
   registration, domain policy, and verified-email rules allow it. An email
   match alone never links an existing account; that user must sign in and use
   the authenticated link flow.
5. A login callback updates the last-login timestamp, creates a signed NextAuth
   JWT with the current session version, writes it directly to the HTTP-only
   `next-auth.session-token` cookie (or its production HTTPS
   `__Secure-next-auth.session-token` form), and redirects to `/dashboard`.
   Linking instead updates the provider account in a transaction, revokes old
   sessions, writes an audit event without tokens, and redirects to `/account`.

Missing, mismatched, expired, replayed, or wrong-purpose state returns the
generic `oauth=invalid` login result. Token exchange, profile, domain,
registration, verification, disabled-account, and duplicate-link failures use
their narrowly scoped error redirects. They do not return provider tokens or
raw state to the application UI.

The former `lib/oauth-login.ts` and `lib/cookies.ts` app-login-token handoff
modules are intentionally absent. OAuth callbacks must not put a bearer token in
a query string, client-readable cookie, rendered link, or client-side exchange:
that would duplicate the current session path and expose a reusable credential
to browser history, logs, extensions, screenshots, and referrers. The
`loginToken` credential that remains in local password/MFA login is a separate,
single-use server handoff and is not an OAuth callback mechanism.

### Tests that enforce the flow

- `tests/e2e/sso.spec.ts` proves that the test provider callback creates an
  authenticated server-side session and rejects missing or mismatched state.
- `tests/integration/one-time-credentials.test.ts` proves provider/PKCE binding,
  expiry, purpose binding, and single-use consumption under concurrency.
- `tests/integration/auth-login.test.ts` rejects the removed
  `oauthLoginToken` credential while retaining the separate local-login token.
- `tests/unit/oauth-security.test.ts` covers account-link identity binding and
  registration decisions; `tests/unit/oauth-provider-profile.test.ts` covers
  provider profile and verified-email interpretation.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
