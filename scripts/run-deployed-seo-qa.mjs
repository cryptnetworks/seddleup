import { spawn } from "node:child_process";

const configuredOrigin = process.env.PUBLIC_APP_URL?.trim();
if (!configuredOrigin) {
  throw new Error("PUBLIC_APP_URL is required for deployed SEO QA.");
}

const origin = new URL(configuredOrigin);
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/") {
  throw new Error("PUBLIC_APP_URL must be a credential-free HTTPS origin with no path.");
}

const child = spawn(
  "node_modules/.bin/playwright",
  ["test", "tests/e2e/seo-production.spec.ts", "--project=Chromium"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: origin.toString().replace(/\/$/, ""),
      PLAYWRIGHT_PUBLIC_APP_URL: origin.toString().replace(/\/$/, ""),
      PLAYWRIGHT_SERVER_MODE: "production"
    },
    stdio: "inherit"
  }
);

child.on("error", (error) => {
  throw error;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
