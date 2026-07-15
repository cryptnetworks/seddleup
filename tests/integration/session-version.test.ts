import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveActiveSessionUser } from "@/lib/session-token";

const userIds: string[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("session version validation", () => {
  it("accepts the current version and rejects an older JWT version", async () => {
    const user = await prisma.user.create({
      data: {
        username: `session-version-${Date.now()}`,
        email: `session-version-${Date.now()}@triptally.test`,
        passwordHash: "fixture",
        emailVerifiedAt: new Date()
      }
    });
    userIds.push(user.id);

    await expect(
      resolveActiveSessionUser({ id: user.id, sessionVersion: user.sessionVersion })
    ).resolves.toMatchObject({ id: user.id, sessionVersion: 0 });

    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } }
    });

    await expect(
      resolveActiveSessionUser({ id: user.id, sessionVersion: user.sessionVersion })
    ).resolves.toBeNull();
    await expect(
      resolveActiveSessionUser({ id: user.id, sessionVersion: user.sessionVersion + 1 })
    ).resolves.toMatchObject({ id: user.id, sessionVersion: 1 });
  });

  it("rejects missing versions, unverified users, and disabled users", async () => {
    const suffix = Date.now();
    const user = await prisma.user.create({
      data: {
        username: `session-invalid-${suffix}`,
        email: `session-invalid-${suffix}@triptally.test`,
        passwordHash: "fixture",
        emailVerifiedAt: null
      }
    });
    userIds.push(user.id);

    await expect(resolveActiveSessionUser({ id: user.id })).resolves.toBeNull();
    await expect(resolveActiveSessionUser({ id: user.id, sessionVersion: 0 })).resolves.toBeNull();
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), disabledAt: new Date() }
    });
    await expect(resolveActiveSessionUser({ id: user.id, sessionVersion: 0 })).resolves.toBeNull();
  });
});
