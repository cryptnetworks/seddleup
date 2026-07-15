import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const temporaryParent = path.resolve("tmp");
await mkdir(temporaryParent, { recursive: true });
const temporaryRoot = await mkdtemp(path.join(temporaryParent, "receipt-e2e-"));
let playwright;

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local receipt E2E port."));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit"
    });
    playwright = child;
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal ?? `status ${code}`}`));
    });
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (playwright && playwright.exitCode === null) playwright.kill(signal);
  });
}

try {
  const port = await availablePort();
  await run(
    "node_modules/.bin/playwright",
    ["test", "tests/e2e/receipts.spec.ts", "--project=Chromium"],
    {
      ...process.env,
      CI: "1",
      PLAYWRIGHT_PORT: String(port),
      PLAYWRIGHT_DATABASE_URL: `file:${path.join(temporaryRoot, "seddleup.db")}`,
      PLAYWRIGHT_RECEIPT_UPLOAD_ENABLED: "true",
      PLAYWRIGHT_RECEIPT_UPLOAD_DIR: path.join(temporaryRoot, "receipts")
    }
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
