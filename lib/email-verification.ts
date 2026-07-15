import crypto from "crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendEmailVerificationEmail } from "@/lib/email";
import { digestLookupToken } from "@/lib/token-digest";

const VERIFICATION_EXPIRATION_HOURS = 24;

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function buildVerificationUrl(token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function createEmailVerificationForUser(user: { id: string; email: string }) {
  const token = generateVerificationToken();
  const now = new Date();

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now }
    }),
    prisma.emailVerificationToken.create({
      data: {
        tokenHash: digestLookupToken(token),
        expiresAt: new Date(now.getTime() + VERIFICATION_EXPIRATION_HOURS * 60 * 60 * 1000),
        userId: user.id
      }
    })
  ]);

  await sendEmailVerificationEmail({
    to: user.email,
    verifyUrl: buildVerificationUrl(token),
    expiresInHours: VERIFICATION_EXPIRATION_HOURS
  });

  logger.info("auth.email_verification.created", { userId: user.id });
}

export async function verifyEmailToken(token: string) {
  const now = new Date();
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: digestLookupToken(token) }
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= now.getTime()) {
    logger.warn("auth.email_verification.invalid_token");
    return false;
  }

  const consumed = await prisma.$transaction(async (tx) => {
    const result = await tx.emailVerificationToken.updateMany({
      where: {
        id: record.id,
        tokenHash: record.tokenHash,
        userId: record.userId,
        usedAt: null,
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });
    if (result.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
    return true;
  });
  if (!consumed) {
    logger.warn("auth.email_verification.invalid_token");
    return false;
  }

  logger.info("auth.email_verification.completed", { userId: record.userId });
  return true;
}
