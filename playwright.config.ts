import { defineConfig, devices } from "@playwright/test";
import { resolvePlaywrightEnvironment } from "./tests/e2e/environment";

const { ownsServer, serverPort, baseURL, databaseUrl, publicAppUrl, receiptUploadDir } =
  resolvePlaywrightEnvironment();
const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "playwright-nextauth-secret-for-tests";
const tokenDigestSecret = process.env.TOKEN_DIGEST_SECRET ?? "playwright-token-digest-secret";
const authConfigEncryptionKey =
  process.env.AUTH_CONFIG_ENCRYPTION_KEY ?? "playwright-auth-config-key-for-tests";
const smtpEnabled = process.env.SMTP_ENABLED ?? "false";
const testOauthProviderEnabled = process.env.TEST_OAUTH_PROVIDER_ENABLED ?? "true";
const receiptUploadEnabled = process.env.PLAYWRIGHT_RECEIPT_UPLOAD_ENABLED ?? "false";

process.env.DATABASE_URL = databaseUrl;
process.env.NEXTAUTH_URL = baseURL;
process.env.PUBLIC_APP_URL = publicAppUrl;
process.env.NEXTAUTH_SECRET = nextAuthSecret;
process.env.TOKEN_DIGEST_SECRET = tokenDigestSecret;
process.env.AUTH_CONFIG_ENCRYPTION_KEY = authConfigEncryptionKey;
process.env.SMTP_ENABLED = smtpEnabled;
process.env.TEST_OAUTH_PROVIDER_ENABLED = testOauthProviderEnabled;
process.env.RECEIPT_UPLOAD_ENABLED = receiptUploadEnabled;
process.env.RECEIPT_UPLOAD_DIR = receiptUploadDir;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 1,
  workers: 1,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: ownsServer
    ? {
        command: `npm run prisma:generate && node scripts/reset-playwright-db.mjs && npm run dev -- -H 127.0.0.1 -p ${serverPort}`,
        env: {
          DATABASE_URL: databaseUrl,
          NEXTAUTH_URL: baseURL,
          PUBLIC_APP_URL: publicAppUrl,
          NEXTAUTH_SECRET: nextAuthSecret,
          TOKEN_DIGEST_SECRET: tokenDigestSecret,
          AUTH_CONFIG_ENCRYPTION_KEY: authConfigEncryptionKey,
          SMTP_ENABLED: smtpEnabled,
          TEST_OAUTH_PROVIDER_ENABLED: testOauthProviderEnabled,
          RECEIPT_UPLOAD_ENABLED: receiptUploadEnabled,
          RECEIPT_UPLOAD_DIR: receiptUploadDir
        },
        url: `${baseURL}/login`,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
        timeout: 120_000
      }
    : undefined,
  projects: [
    {
      name: "Chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "Firefox",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "WebKit",
      use: { ...devices["Desktop Safari"] }
    },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 740 }
      }
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 13"]
      }
    }
  ]
});
