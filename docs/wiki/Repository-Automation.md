# Repository Automation

SeddleUp includes GitHub automation for validation, Docker images, dependency updates, and security scanning.

## CI

The CI workflow runs on pushes and pull requests. It installs dependencies, validates configuration, validates Prisma, runs formatting checks, lint, TypeScript, unit/integration tests, e2e tests, and a production build.

Local equivalent:

```bash
npm run validate:config
npx prisma validate
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Docker Image Publishing

The Docker workflow builds the app image and publishes to GitHub Container Registry from `main` and tags. Images are tagged by branch, SHA, and `latest` where applicable.

The repository README and wiki currently pin the published image by digest for reproducible deployments.

## Security Workflow

The security workflow runs:

- `npm run security:audit` for high and critical npm advisories.
- Trivy filesystem scan.
- Trivy Docker image scan.

CodeQL is expected to run through GitHub default setup in repository settings. The repo does not define an advanced CodeQL workflow because GitHub rejects advanced CodeQL SARIF uploads while default setup is enabled.

Current npm audit output is expected to be clean. Vulnerable transitive dependencies may be pinned with scoped npm overrides when upstream packages lag patched versions. Do not run `npm audit fix --force` without reviewing breaking changes.

## Dependency Review

Pull requests run GitHub dependency review and fail on vulnerable dependency changes at the configured threshold.

## Dependabot

Dependabot checks:

- npm packages
- GitHub Actions
- Docker base images

Minor and patch updates are grouped where practical. Security updates should be reviewed promptly and tested through CI before merge.

Current major-version deferrals:

- ESLint 10 is ignored until `eslint-config-next` and its bundled React/import/accessibility plugins publish compatible peer ranges.
- Node 26 Docker image updates are ignored while Node 26 is a Current release. Production Docker images stay on Node 22 Alpine LTS until the runtime stack has clean support.

SeddleUp sends SMTP mail through EmailJS. Do not reintroduce a direct Nodemailer dependency unless NextAuth and the app email layer are reviewed together for peer compatibility.

## Release Workflow

Version tags matching `v*.*.*` create a GitHub release with generated notes. Docker image publishing is handled by the Docker workflow for tag pushes.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
