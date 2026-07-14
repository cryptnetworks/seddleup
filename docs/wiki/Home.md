# SeddleUp Wiki

SeddleUp is a Docker-deployable Next.js application for tracking group trip expenses, participants, balances, and settlement suggestions.

This wiki is the operational and contributor documentation for the project.

## Start Here

- [Running with Docker](Running-with-Docker)
- [Configuration](Configuration)
- [Cloudflare Tunnel Deployment](Cloudflare-Tunnel-Deployment)
- [Nginx and Let's Encrypt Deployment](Nginx-and-Lets-Encrypt-Deployment)
- [Admin and OAuth Providers](Admin-and-OAuth-Providers)
- [Email and MFA](Email-and-MFA)
- [Backups and Updates](Backups-and-Updates)
- [Security Model](Security-Model)
- [Screenshots](Screenshots)
- [Repository Automation](Repository-Automation)
- [Architecture](Architecture)
- [Contributing](Contributing)
- [Troubleshooting](Troubleshooting)

## Current Published Image

```bash
docker pull ghcr.io/cryptnetworks/seddleup:latest
```

## Main Capabilities

- Trip, participant, expense, balance, and settlement tracking
- Collaborative trip memberships with owner/admin/member/viewer permissions
- Member-created expenses with draft, submitted, disputed, approved, and settled states
- Credentials login with email verification and password reset
- Admin and trip invitations for new users
- Email-code or authenticator-app MFA
- Admin portal for users, auth providers, settings, and audit logs
- OAuth login and account linking for Google, GitHub, Discord, and Facebook
- Docker healthcheck at `/api/health`
- Revocable read-only trip-cost sharing with privacy-filtered participant labels
- SQLite persistence in the Docker volume at `/app/data`
- CI, Docker image publishing, dependency review, Dependabot, and security scan automation

## Application Preview

The dashboard and trip ledger are the quickest way to understand the shape of the app once it is configured.

![SeddleUp dashboard showing trip summaries, status mix, and settlement queue](https://raw.githubusercontent.com/cryptnetworks/seddleup/main/docs/assets/screenshots/seddleup-dashboard.png)

See the full [Screenshots](Screenshots) gallery for the trip ledger, expense entry, and account/payment handle views.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
