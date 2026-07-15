import type { Prisma } from "@prisma/client";

export async function revokeUserSessionsInTransaction(
  tx: Prisma.TransactionClient,
  userId: string
) {
  await tx.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } }
  });
  await tx.twoFactorChallenge.deleteMany({ where: { userId } });
  await tx.oAuthStateCredential.deleteMany({ where: { userId } });
}
