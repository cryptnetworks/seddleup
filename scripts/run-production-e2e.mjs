import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const chunkLoadErrorPattern = /ChunkLoadError|Loading chunk [^\n]+ failed|Failed to load chunk/i;
const temporaryParent = path.resolve("tmp");
await mkdir(temporaryParent, { recursive: true });
const temporaryRoot = await mkdtemp(path.join(temporaryParent, "production-e2e-"));
const databasePath = path.join(temporaryRoot, "seddleup.db");
const receiptUploadDir = path.join(temporaryRoot, "receipts");
let application;
let interrupted = false;
const activeChildren = new Set();

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    activeChildren.add(child);
    let output = "";

    if (options.capture) {
      for (const stream of [child.stdout, child.stderr]) {
        stream.on("data", (chunk) => {
          const text = chunk.toString();
          output = `${output}${text}`.slice(-250_000);
          (stream === child.stderr ? process.stderr : process.stdout).write(chunk);
        });
      }
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      activeChildren.delete(child);
      if (code === 0) resolve({ output });
      else reject(new Error(`${command} exited with ${signal ?? `status ${code}`}`));
    });
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local production E2E port."));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForReadiness(baseURL, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Production server exited before readiness.");
    try {
      const response = await fetch(`${baseURL}/api/health`);
      if (response.ok) return;
    } catch {
      // Connection failures are expected while the bounded readiness loop waits for startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Production server did not become ready within 90 seconds.");
}

function stopApplication() {
  if (application && application.exitCode === null) application.kill("SIGTERM");
}

function stopChildren(signal = "SIGTERM") {
  for (const child of activeChildren) {
    if (child.exitCode === null) child.kill(signal);
  }
  stopApplication();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = true;
    stopChildren(signal);
  });
}

try {
  const port = await availablePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const databaseUrl = `file:${databasePath}`;
  const productionEnvironment = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    NEXTAUTH_URL: baseURL,
    PUBLIC_APP_URL: "https://qa.seddleup.invalid",
    NEXTAUTH_SECRET: "production-e2e-nextauth-secret-not-for-production",
    TOKEN_DIGEST_SECRET: "production-e2e-token-digest-not-for-production",
    AUTH_CONFIG_ENCRYPTION_KEY: "production-e2e-config-key-not-for-production",
    SMTP_ENABLED: "false",
    TEST_OAUTH_PROVIDER_ENABLED: "true",
    RECEIPT_UPLOAD_ENABLED: "false",
    RECEIPT_UPLOAD_DIR: receiptUploadDir
  };

  await run("npm", ["run", "prisma:generate"], { env: productionEnvironment });
  await run("node_modules/.bin/prisma", ["migrate", "deploy"], {
    env: { ...productionEnvironment, RUST_LOG: "info" }
  });
  await run("npm", ["run", "build"], { env: productionEnvironment });

  let serverOutput = "";
  application = spawn("node_modules/.bin/next", ["start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: process.cwd(),
    env: productionEnvironment,
    stdio: ["ignore", "pipe", "pipe"]
  });
  application.on("error", (error) => {
    process.stderr.write(`Production server failed to start: ${error.message}\n`);
  });
  for (const stream of [application.stdout, application.stderr]) {
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      serverOutput = `${serverOutput}${text}`.slice(-250_000);
      (stream === application.stderr ? process.stderr : process.stdout).write(chunk);
    });
  }

  await waitForReadiness(baseURL, application);

  const forwardedArguments = process.argv.slice(2);
  const hasProject = forwardedArguments.some((argument) => argument.startsWith("--project"));
  const defaultTests = ["tests/e2e/production-smoke.spec.ts", "tests/e2e/seo-production.spec.ts"];
  await run(
    "node_modules/.bin/playwright",
    [
      "test",
      ...(forwardedArguments.length ? forwardedArguments : defaultTests),
      ...(hasProject ? [] : ["--project=Chromium"])
    ],
    {
      env: {
        ...productionEnvironment,
        PLAYWRIGHT_BASE_URL: baseURL,
        PLAYWRIGHT_DATABASE_URL: databaseUrl,
        PLAYWRIGHT_PUBLIC_APP_URL: productionEnvironment.PUBLIC_APP_URL,
        PLAYWRIGHT_RECEIPT_UPLOAD_DIR: receiptUploadDir,
        PLAYWRIGHT_SERVER_MODE: "production"
      }
    }
  );

  if (chunkLoadErrorPattern.test(serverOutput)) {
    throw new Error("Production server emitted a chunk-load error during browser verification.");
  }
} finally {
  stopChildren();
  await rm(temporaryRoot, { recursive: true, force: true });
}

if (interrupted) process.exitCode = 130;
