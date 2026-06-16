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
- [Repository Automation](Repository-Automation)
- [Architecture](Architecture)
- [Contributing](Contributing)
- [Troubleshooting](Troubleshooting)

## Current Published Image

```bash
docker pull ghcr.io/cryptnetworks/seddleup:sha-292a632@sha256:9a2387e29e29bf862a056619192a3cf3256b74a5d4fc67e97467321c43957207
```

## Main Capabilities

- Trip, participant, expense, balance, and settlement tracking
- Collaborative trip memberships with owner/admin/member/viewer permissions
- Member-created expenses with draft, submitted, disputed, approved, and settled states
- Credentials login with email verification and password reset
- Email-code or authenticator-app MFA
- Admin portal for users, auth providers, settings, and audit logs
- OAuth login and account linking for Google, GitHub, Discord, and Facebook
- Docker healthcheck at `/api/health`
- SQLite persistence in the Docker volume at `/app/data`
- CI, Docker image publishing, dependency review, Dependabot, and security scan automation

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
