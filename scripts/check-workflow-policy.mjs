import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const workflowDirectory = path.resolve(".github/workflows");
const workflowFiles = (await readdir(workflowDirectory))
  .filter((file) => /\.ya?ml$/.test(file))
  .sort();
const failures = [];

for (const file of workflowFiles) {
  const content = await readFile(path.join(workflowDirectory, file), "utf8");
  const handlesPullRequests = /^\s{0,2}pull_request\s*:/m.test(content);
  if (handlesPullRequests && /\bself-hosted\b/i.test(content)) {
    failures.push(`${file}: pull_request workflows must not reference self-hosted runners`);
  }
  if (/^\s{0,2}pull_request_target\s*:/m.test(content)) {
    failures.push(`${file}: pull_request_target is not allowed for repository code execution`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`Validated runner policy in ${workflowFiles.length} workflow files.`);
}
