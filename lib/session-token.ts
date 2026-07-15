import { prisma } from "@/lib/prisma";

export async function resolveActiveSessionUser(input: { id?: string; sessionVersion?: number }) {
  if (!input.id || typeof input.sessionVersion !== "number") return null;
  const user = await prisma.user.findUnique({
    where: { id: input.id },
    select: { id: true, disabledAt: true, emailVerifiedAt: true, sessionVersion: true }
  });
  if (
    !user ||
    user.disabledAt ||
    !user.emailVerifiedAt ||
    user.sessionVersion !== input.sessionVersion
  ) {
    return null;
  }
  return user;
}
