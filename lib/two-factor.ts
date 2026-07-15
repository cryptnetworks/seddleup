import crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendTwoFactorEmail } from "@/lib/email";
import { decryptSecret, encryptSecret } from "@/lib/secret-encryption";
import { buildAuthenticatorUri, generateAuthenticatorSecret, verifyTotpCode } from "@/lib/totp";

export const twoFactorMethods = ["none", "email", "authenticator"] as const;
export type TwoFactorMethod = (typeof twoFactorMethods)[number];

const EMAIL_CODE_EXPIRATION_MINUTES = 10;

function generateEmailCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function startEmailTwoFactorChallenge(user: { id: string; email: string }) {
  const code = generateEmailCode();
  const now = new Date();

  await prisma.$transaction([
    prisma.twoFactorChallenge.updateMany({
      where: { userId: user.id, method: "email", usedAt: null },
      data: { usedAt: now }
    }),
    prisma.twoFactorChallenge.create({
      data: {
        codeHash: await bcrypt.hash(code, 12),
        method: "email",
        expiresAt: new Date(now.getTime() + EMAIL_CODE_EXPIRATION_MINUTES * 60 * 1000),
        userId: user.id
      }
    })
  ]);

  await sendTwoFactorEmail({
    to: user.email,
    code,
    expiresInMinutes: EMAIL_CODE_EXPIRATION_MINUTES
  });

  logger.info("auth.two_factor.email_challenge.created", { userId: user.id });
}

export async function verifyEmailTwoFactorCode(userId: string, code: string) {
  const now = new Date();
  const challenge = await prisma.twoFactorChallenge.findFirst({
    where: {
      userId,
      method: "email",
      usedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!challenge || !(await bcrypt.compare(code.trim(), challenge.codeHash))) {
    logger.warn("auth.two_factor.email_challenge.invalid", { userId });
    return false;
  }

  const consumed = await prisma.twoFactorChallenge.updateMany({
    where: {
      id: challenge.id,
      userId,
      method: "email",
      codeHash: challenge.codeHash,
      usedAt: null,
      expiresAt: { gt: now }
    },
    data: { usedAt: now }
  });
  if (consumed.count !== 1) {
    logger.warn("auth.two_factor.email_challenge.invalid", { userId });
    return false;
  }

  logger.info("auth.two_factor.email_challenge.verified", { userId });
  return true;
}

export async function createAuthenticatorSetup(user: { id: string; email: string }) {
  const secret = generateAuthenticatorSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      authenticatorSecretEncrypted: encryptSecret(secret),
      authenticatorEnabled: false
    }
  });

  logger.info("auth.two_factor.authenticator.setup_created", { userId: user.id });
  return {
    secret,
    uri: buildAuthenticatorUri({
      appName: process.env.EMAIL_APP_NAME || "SeddleUp",
      email: user.email,
      secret
    })
  };
}

export function pendingAuthenticatorSetup(user: {
  email: string;
  authenticatorEnabled: boolean;
  authenticatorSecretEncrypted: string | null;
}) {
  if (user.authenticatorEnabled || !user.authenticatorSecretEncrypted) {
    return null;
  }

  const secret = decryptSecret(user.authenticatorSecretEncrypted);
  return {
    secret,
    uri: buildAuthenticatorUri({
      appName: process.env.EMAIL_APP_NAME || "SeddleUp",
      email: user.email,
      secret
    })
  };
}

export async function enableAuthenticator(userId: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { authenticatorSecretEncrypted: true }
  });

  if (!user?.authenticatorSecretEncrypted) {
    return false;
  }

  const secret = decryptSecret(user.authenticatorSecretEncrypted);
  if (!verifyTotpCode(secret, code)) {
    logger.warn("auth.two_factor.authenticator.invalid_setup_code", { userId });
    return false;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      authenticatorEnabled: true,
      twoFactorMethod: "authenticator"
    }
  });

  logger.info("auth.two_factor.authenticator.enabled", { userId });
  return true;
}

export async function verifyAuthenticatorCode(
  user: {
    id: string;
    authenticatorSecretEncrypted: string | null;
  },
  code: string
) {
  if (!user.authenticatorSecretEncrypted) {
    return false;
  }

  const secret = decryptSecret(user.authenticatorSecretEncrypted);
  const isValid = verifyTotpCode(secret, code);
  if (!isValid) {
    logger.warn("auth.two_factor.authenticator.invalid_code", { userId: user.id });
  }
  return isValid;
}
