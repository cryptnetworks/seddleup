import crypto from "node:crypto";
import * as bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consumeDiscordLinkToken, createDiscordLinkToken } from "@/lib/discord/linking";
import { verifyEmailToken } from "@/lib/email-verification";
import { consumeSessionLoginToken, createSessionLoginToken } from "@/lib/login-token";
import { consumeOAuthStateCredential, createOAuthStateCredential } from "@/lib/oauth-state";
import { completePasswordReset } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { digestLookupToken } from "@/lib/token-digest";
import { verifyEmailTwoFactorCode } from "@/lib/two-factor";

const testRun = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const createdUserIds: string[] = [];

function opaqueCredential() {
  return crypto.randomBytes(32).toString("base64url");
}

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: {
      username: `credential-${label}-${testRun}`,
      email: `credential-${label}-${testRun}@example.test`,
      passwordHash: await bcrypt.hash("TestPass123", 4)
    }
  });
  createdUserIds.push(user.id);
  return user;
}

beforeAll(() => {
  process.env.TOKEN_DIGEST_SECRET = "integration-token-digest-secret-long-enough";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  process.env.PUBLIC_APP_URL = "http://localhost:3000";
});

afterAll(async () => {
  await prisma.oAuthStateCredential.deleteMany();
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("atomic one-time credential consumption", () => {
  it("allows exactly one concurrent password reset and keeps password state aligned", async () => {
    const user = await createUser("reset");
    const token = opaqueCredential();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: digestLookupToken(token),
        expiresAt: new Date(Date.now() + 60_000),
        userId: user.id
      }
    });
    await createSessionLoginToken(user.id);

    const attempts = await Promise.all([
      completePasswordReset(token, "FirstPass123"),
      completePasswordReset(token, "SecondPass123")
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const firstMatches = await bcrypt.compare("FirstPass123", updated.passwordHash);
    const secondMatches = await bcrypt.compare("SecondPass123", updated.passwordHash);
    expect([firstMatches, secondMatches].filter(Boolean)).toHaveLength(1);
    expect(attempts[0] ? firstMatches : secondMatches).toBe(true);
    expect(updated.sessionVersion).toBe(1);
    await expect(prisma.twoFactorChallenge.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("allows exactly one concurrent email-verification use", async () => {
    const user = await createUser("verification");
    const token = opaqueCredential();
    await prisma.emailVerificationToken.create({
      data: {
        tokenHash: digestLookupToken(token),
        expiresAt: new Date(Date.now() + 60_000),
        userId: user.id
      }
    });

    const attempts = await Promise.all([verifyEmailToken(token), verifyEmailToken(token)]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toMatchObject({
      emailVerifiedAt: expect.any(Date)
    });
  });

  it("allows exactly one concurrent email MFA use", async () => {
    const user = await createUser("email-mfa");
    const code = String(crypto.randomInt(100000, 1000000));
    await prisma.twoFactorChallenge.create({
      data: {
        codeHash: await bcrypt.hash(code, 4),
        method: "email",
        expiresAt: new Date(Date.now() + 60_000),
        userId: user.id
      }
    });

    const attempts = await Promise.all([
      verifyEmailTwoFactorCode(user.id, code),
      verifyEmailTwoFactorCode(user.id, code)
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
  });

  it("allows exactly one concurrent session-login token use", async () => {
    const user = await createUser("session-login");
    const token = await createSessionLoginToken(user.id);

    const attempts = await Promise.all([
      consumeSessionLoginToken(token),
      consumeSessionLoginToken(token)
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(attempts.find(Boolean)).toMatchObject({ id: user.id });
  });

  it("allows exactly one Discord account link and rolls token use into the link transaction", async () => {
    const firstUser = await createUser("discord-first");
    const secondUser = await createUser("discord-second");
    const discordUserId = `discord-${testRun}`;
    const linkUrl = await createDiscordLinkToken({ discordUserId });
    const token = new URL(linkUrl).searchParams.get("discordLinkToken");
    if (!token) throw new Error("Discord fixture did not produce a link credential.");

    const attempts = await Promise.all([
      consumeDiscordLinkToken(token, firstUser.id),
      consumeDiscordLinkToken(token, secondUser.id)
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    await expect(prisma.discordAccount.count({ where: { discordUserId } })).resolves.toBe(1);
  });

  it("binds OAuth state to provider and PKCE before one atomic success", async () => {
    const state = opaqueCredential();
    const verifier = opaqueCredential();
    await createOAuthStateCredential({
      state,
      verifier,
      providerId: "test",
      purpose: "login"
    });

    await expect(
      consumeOAuthStateCredential({ state, verifier, providerId: "different" })
    ).resolves.toBeNull();
    const attempts = await Promise.all([
      consumeOAuthStateCredential({ state, verifier, providerId: "test" }),
      consumeOAuthStateCredential({ state, verifier, providerId: "test" })
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(attempts.find(Boolean)).toEqual({ purpose: "login", userId: null });
  });

  it("binds OAuth link state to its purpose and intended user", async () => {
    const user = await createUser("oauth-link-purpose");
    const state = opaqueCredential();
    const verifier = opaqueCredential();
    await createOAuthStateCredential({
      state,
      verifier,
      providerId: "test",
      purpose: "link",
      userId: user.id
    });

    await expect(
      consumeOAuthStateCredential({ state, verifier, providerId: "test" })
    ).resolves.toEqual({ purpose: "link", userId: user.id });
    await expect(
      consumeOAuthStateCredential({ state, verifier, providerId: "test" })
    ).resolves.toBeNull();
    await expect(
      createOAuthStateCredential({
        state: opaqueCredential(),
        verifier: opaqueCredential(),
        providerId: "test",
        purpose: "link"
      })
    ).rejects.toThrow("requires exactly one intended user");
  });

  it("does not substitute credentials across purposes or accept expired records", async () => {
    const user = await createUser("purpose");
    const sessionToken = await createSessionLoginToken(user.id);
    await expect(verifyEmailToken(sessionToken)).resolves.toBe(false);

    const expiredReset = opaqueCredential();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: digestLookupToken(expiredReset),
        expiresAt: new Date(Date.now() - 1_000),
        userId: user.id
      }
    });
    await expect(completePasswordReset(expiredReset, "IgnoredPass123")).resolves.toBe(false);
  });
});
