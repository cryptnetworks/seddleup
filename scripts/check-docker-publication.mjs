import { readFile } from "node:fs/promises";

const [workflow, dockerignore, compose] = await Promise.all([
  readFile(".github/workflows/docker-image.yml", "utf8"),
  readFile(".dockerignore", "utf8"),
  readFile("docker-compose.yml", "utf8")
]);
const failures = [];
for (const fragment of [
  "DOCKERHUB_NAMESPACE",
  "DOCKERHUB_USERNAME",
  "DOCKERHUB_TOKEN",
  "digest-manifest-ghcr-${{ matrix.artifact }}-${{ github.sha }}",
  "digest-manifest-dockerhub-${{ matrix.artifact }}-${{ github.sha }}",
  "linux/amd64,linux/arm64",
  "org.opencontainers.image.revision=${{ github.sha }}",
  "type=raw,value=main,enable={{is_default_branch}}",
  "!contains(github.ref_name, '-')"
]) {
  if (!workflow.includes(fragment)) failures.push(`Docker workflow is missing: ${fragment}`);
}
if (!workflow.includes("if: github.event_name != 'pull_request'")) {
  failures.push("Docker publication must remain disabled for pull requests.");
}
for (const ignored of [".env.*", "*.db", "*.sqlite", "uploads", "test-results", ".cache"]) {
  if (!dockerignore.split(/\r?\n/).includes(ignored)) {
    failures.push(`.dockerignore must exclude ${ignored}.`);
  }
}
const imageSelector = "${SEDDLEUP_IMAGE:-ghcr.io/cryptnetworks/seddleup:latest}";
if (compose.split(imageSelector).length - 1 !== 2) {
  failures.push("Both application services must use the backward-compatible image selector.");
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log("Validated dual-registry publication policy and Docker build-context exclusions.");
}
