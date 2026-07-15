import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, redactLogFields, serializeLogEntry } from "@/lib/logger";

const forbiddenFixtures = {
  password: "fixture-password-value",
  passwordResetToken: "fixture-reset-token-value",
  verificationToken: "fixture-verification-token-value",
  invitationToken: "fixture-invitation-token-value",
  shareBearerToken: "fixture-share-token-value",
  oauthState: "fixture-oauth-state-value",
  authorizationCode: "fixture-authorization-code-value",
  clientSecret: "fixture-client-secret-value",
  mfaCode: "184205",
  totpSeed: "JBSWY3DPEHPK3PXP",
  recoveryCredential: "fixture-recovery-value",
  smtpPassword: "fixture-smtp-password-value",
  discordBotToken: "fixture-discord-token-value",
  receiptStoredPath: "/private/receipts/user/fixture.pdf",
  databaseUrl: "postgresql://private-user:private-password@database.invalid/seddleup"
};

function assertNoForbiddenFixtures(output: string) {
  for (const [fixtureName, fixtureValue] of Object.entries(forbiddenFixtures)) {
    if (output.includes(fixtureValue)) {
      throw new Error(`Log redaction failed for fixture: ${fixtureName}`);
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("log redaction", () => {
  it("redacts structured secret fields while retaining operational context", () => {
    const fields = redactLogFields({
      userId: "user_123",
      tripId: "trip_456",
      ...forbiddenFixtures,
      nested: {
        token: forbiddenFixtures.passwordResetToken,
        url: `/reset-password?token=${forbiddenFixtures.passwordResetToken}`
      }
    });
    const rendered = JSON.stringify(fields);

    assertNoForbiddenFixtures(rendered);
    expect(fields).toMatchObject({
      userId: "user_123",
      tripId: "trip_456",
      password: "[REDACTED]",
      nested: { token: "[REDACTED]" }
    });
  });

  it("redacts rendered URLs, bearer values, email addresses, and connection strings", () => {
    const line = serializeLogEntry(
      "warn",
      "security.redaction.probe",
      {
        userId: "user_123",
        callback: `https://app.invalid/callback?state=${forbiddenFixtures.oauthState}&code=${forbiddenFixtures.authorizationCode}`,
        authorizationHeader: `Bearer ${forbiddenFixtures.shareBearerToken}`,
        contact: "private.person@example.com",
        error: `Could not connect to ${forbiddenFixtures.databaseUrl}`
      },
      new Date("2026-07-14T12:00:00.000Z")
    );

    assertNoForbiddenFixtures(line);
    expect(line).toContain('"event":"security.redaction.probe"');
    expect(line).toContain('"userId":"user_123"');
    expect(line).toContain('"time":"2026-07-14T12:00:00.000Z"');
  });

  it("applies redaction at the final console boundary", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("auth.secret.probe", {
      userId: "user_123",
      password: forbiddenFixtures.password,
      mfaCode: forbiddenFixtures.mfaCode,
      receiptStoredPath: forbiddenFixtures.receiptStoredPath
    });

    expect(info).toHaveBeenCalledOnce();
    const line = String(info.mock.calls[0]?.[0]);
    assertNoForbiddenFixtures(line);
    expect(line).toContain('"event":"auth.secret.probe"');
    expect(line).toContain('"userId":"user_123"');
  });
});
