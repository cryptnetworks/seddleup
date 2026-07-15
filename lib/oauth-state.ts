import { prisma } from "@/lib/prisma";
import { digestLookupToken, timingSafeEqualTokenDigest } from "@/lib/token-digest";

const OAUTH_STATE_EXPIRATION_MINUTES = 10;
export type OAuthStatePurpose = "login" | "link";

export async function createOAuthStateCredential(input: {
  state: string;
  verifier: string;
  providerId: string;
  purpose: OAuthStatePurpose;
  userId?: string;
  now?: Date;
}) {
  if ((input.purpose === "link") !== Boolean(input.userId)) {
    throw new Error("OAuth link state requires exactly one intended user.");
  }
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + OAUTH_STATE_EXPIRATION_MINUTES * 60 * 1000);
  await prisma.$transaction([
    prisma.oAuthStateCredential.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.oAuthStateCredential.create({
      data: {
        stateHash: digestLookupToken(input.state),
        verifierHash: digestLookupToken(input.verifier),
        providerId: input.providerId,
        purpose: input.purpose,
        userId: input.userId,
        expiresAt
      }
    })
  ]);
}

export async function consumeOAuthStateCredential(input: {
  state: string;
  verifier: string;
  providerId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const stateHash = digestLookupToken(input.state);
  const verifierHash = digestLookupToken(input.verifier);
  const record = await prisma.oAuthStateCredential.findUnique({ where: { stateHash } });
  if (
    !record ||
    record.providerId !== input.providerId ||
    record.usedAt ||
    record.expiresAt <= now ||
    !timingSafeEqualTokenDigest(input.state, record.stateHash) ||
    !timingSafeEqualTokenDigest(input.verifier, record.verifierHash)
  ) {
    return null;
  }

  const consumed = await prisma.oAuthStateCredential.updateMany({
    where: {
      id: record.id,
      stateHash,
      verifierHash,
      providerId: input.providerId,
      usedAt: null,
      expiresAt: { gt: now }
    },
    data: { usedAt: now }
  });
  return consumed.count === 1
    ? { purpose: record.purpose as OAuthStatePurpose, userId: record.userId }
    : null;
}
