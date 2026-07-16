# Shared Rate-Limit Store Contract

SeddleUp keeps its current single-instance behavior by default: login uses the
persistent Prisma bucket table and lower-risk actions use process memory. Setting
`RATE_LIMIT_SHARED_URL` opts every application limiter into an operator-provided
HTTP store so replicas can make decisions against one atomic counter service.
No Redis or hosted vendor is required by the application.

This option coordinates rate limits only. It does not make the current SQLite
application data architecture safe for multi-replica deployment; PostgreSQL or
another supported shared application database remains separate future work.

## Configuration

```dotenv
RATE_LIMIT_SHARED_URL=https://rate-limit.internal.example/v1/check
RATE_LIMIT_SHARED_TOKEN=generate-a-dedicated-random-secret
RATE_LIMIT_SHARED_FAILURE_MODE=deny
RATE_LIMIT_SHARED_TIMEOUT_MS=1500
```

- The URL must be HTTP(S), cannot contain embedded credentials, and must use
  HTTPS in production. Private certificate trust must be configured at the host
  or container boundary; disabling TLS verification is unsupported.
- The dedicated bearer token must contain at least 24 characters. Rotate it in
  coordination with the service. Never reuse `NEXTAUTH_SECRET` or
  `TOKEN_DIGEST_SECRET`.
- Timeout is an integer from 100 through 10000 milliseconds.
- `deny` is the default outage mode. A timeout, network failure, non-2xx result,
  malformed response, or mismatched result count denies the attempted operation.
  This preserves protection but makes authentication and protected actions
  depend on the store's availability.
- `local` explicitly favors availability. During an outage each process falls
  back to its own memory buckets. Users are not globally locked out, but replicas
  no longer share counters and an attacker may receive up to the limit per
  process. Monitor the store externally and restore it promptly.

With no URL, the token and failure settings do not activate a shared store and
normal single-instance behavior is unchanged.

## Service protocol

SeddleUp sends an authenticated `POST` with `content-type: application/json`:

```json
{
  "version": 1,
  "buckets": [
    {
      "key": "64-character-keyed-digest",
      "limit": 8,
      "windowMs": 900000
    }
  ]
}
```

The application HMAC-digests each internal bucket identifier before sending it.
Email addresses, source addresses, bearer tokens, invitation tokens, and raw
request data are not part of the request. The Authorization bearer token must
also never appear in service logs.

The service must atomically evaluate and increment all supplied buckets using
its own monotonic wall-clock policy, and return results in input order:

```json
{
  "results": [
    {
      "allowed": true,
      "remaining": 7,
      "resetAt": 1784116800000
    }
  ]
}
```

`remaining` is a non-negative integer and `resetAt` is a finite Unix epoch time
in milliseconds. A request is usable only when every result is valid and the
count matches. The service should enforce bounded key/window/limit inputs,
expire idle buckets, prevent counter races with an atomic script/transaction,
rate-limit the application credential itself, and expose private availability
metrics without bucket keys.

## Operations and rollout

Deploy at least the availability level required by login, test TLS and token
rotation, and alert on latency/error saturation before enabling the URL. Canary
one application instance, confirm cross-instance counter sharing, expiry,
restart persistence, failure-mode behavior, and redacted service logs, then roll
out consistently. Mixed configured/unconfigured replicas do not enforce one
global policy.

Rollback is configuration-only: remove `RATE_LIMIT_SHARED_URL` from every
replica and restart. This returns login to its Prisma buckets and other actions
to process memory; it does not import shared counters. Schedule rollback with
the temporary loss of shared counter history in mind.
