import path from "node:path";

type PlaywrightEnvironment = Record<string, string | undefined>;

export function resolvePlaywrightEnvironment(environment: PlaywrightEnvironment = process.env) {
  const ownsServer = !environment.PLAYWRIGHT_BASE_URL;
  const serverPort = Number(environment.PLAYWRIGHT_PORT ?? "3000");
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) {
    throw new Error("PLAYWRIGHT_PORT must be an integer between 1 and 65535.");
  }
  const baseURL = environment.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${serverPort}`;
  const databaseUrl =
    environment.PLAYWRIGHT_DATABASE_URL ??
    (ownsServer
      ? `file:${path.resolve("prisma/playwright.db")}`
      : (environment.DATABASE_URL ?? `file:${path.resolve("prisma/playwright.db")}`));
  const publicAppUrl =
    environment.PLAYWRIGHT_PUBLIC_APP_URL ??
    (ownsServer ? baseURL : (environment.PUBLIC_APP_URL ?? baseURL));
  const receiptUploadDir =
    environment.PLAYWRIGHT_RECEIPT_UPLOAD_DIR ?? path.resolve("tmp/playwright-receipts");

  return {
    ownsServer,
    serverPort,
    baseURL,
    databaseUrl,
    publicAppUrl,
    receiptUploadDir
  };
}
