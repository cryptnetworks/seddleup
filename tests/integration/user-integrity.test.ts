import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { OwnershipTransferError, transferTripOwnershipInTransaction } from "@/lib/user-integrity";

const testRun = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const createdUserIds: string[] = [];

async function createUser(label: string, data: { role?: string; disabledAt?: Date | null } = {}) {
  const user = await prisma.user.create({
    data: {
      username: `user-integrity-${label}-${testRun}`,
      email: `user-integrity-${label}-${testRun}@example.test`,
      passwordHash: await bcrypt.hash("TestPass123", 4),
      ...data
    }
  });
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  await prisma.trip.deleteMany({ where: { ownerId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("owned-trip account integrity", () => {
  it("restricts owner deletion at the database boundary", async () => {
    const owner = await createUser("restricted-owner");
    const trip = await prisma.trip.create({
      data: { name: "Restricted trip", ownerId: owner.id }
    });

    await expect(prisma.user.delete({ where: { id: owner.id } })).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError
    );
    await expect(prisma.trip.findUnique({ where: { id: trip.id } })).resolves.toMatchObject({
      ownerId: owner.id
    });
  });

  it("transfers ownership, membership, and audit-relevant records without loss", async () => {
    const previousOwner = await createUser("previous-owner");
    const replacement = await createUser("replacement");
    const trip = await prisma.trip.create({
      data: {
        name: "Transfer trip",
        ownerId: previousOwner.id,
        members: { create: { userId: previousOwner.id, role: "owner" } },
        participants: { create: [{ name: "Payer" }, { name: "Sharer" }] }
      },
      include: { participants: true }
    });
    const expense = await prisma.expense.create({
      data: {
        title: "Preserved expense",
        amount: new Prisma.Decimal("12.00"),
        category: "Food",
        date: new Date(),
        tripId: trip.id,
        payerId: trip.participants[0].id,
        shares: {
          create: {
            participantId: trip.participants[1].id,
            shareAmount: new Prisma.Decimal("12.00")
          }
        }
      }
    });

    const result = await prisma.$transaction((tx) =>
      transferTripOwnershipInTransaction(tx, {
        tripId: trip.id,
        replacementOwnerId: replacement.id
      })
    );

    expect(result).toMatchObject({
      previousOwnerId: previousOwner.id,
      replacementOwnerId: replacement.id
    });
    await expect(prisma.trip.findUnique({ where: { id: trip.id } })).resolves.toMatchObject({
      ownerId: replacement.id
    });
    await expect(
      prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: trip.id, userId: replacement.id } }
      })
    ).resolves.toMatchObject({ role: "owner" });
    await expect(
      prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: trip.id, userId: previousOwner.id } }
      })
    ).resolves.toMatchObject({ role: "admin" });
    await expect(prisma.expense.findUnique({ where: { id: expense.id } })).resolves.not.toBeNull();
  });

  it.each([
    ["disabled", { disabledAt: new Date() }, "replacement-disabled"],
    ["readonly", { role: "readonly" }, "replacement-readonly"]
  ])("rolls back a transfer to an invalid %s replacement", async (label, data, reason) => {
    const owner = await createUser(`${label}-owner`);
    const replacement = await createUser(`${label}-replacement`, data);
    const trip = await prisma.trip.create({
      data: { name: `${label} transfer`, ownerId: owner.id }
    });

    await expect(
      prisma.$transaction((tx) =>
        transferTripOwnershipInTransaction(tx, {
          tripId: trip.id,
          replacementOwnerId: replacement.id
        })
      )
    ).rejects.toMatchObject({
      reason: reason as OwnershipTransferError["reason"]
    } satisfies Partial<OwnershipTransferError>);
    await expect(prisma.trip.findUnique({ where: { id: trip.id } })).resolves.toMatchObject({
      ownerId: owner.id
    });
    await expect(
      prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: trip.id, userId: replacement.id } }
      })
    ).resolves.toBeNull();
  });

  it("preserves nullable audit attribution when deleting an unblocked user", async () => {
    const user = await createUser("audit-attribution");
    const audit = await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "fixture.action",
        targetType: "user",
        targetId: user.id
      }
    });

    await prisma.user.delete({ where: { id: user.id } });
    createdUserIds.splice(createdUserIds.indexOf(user.id), 1);

    await expect(prisma.auditLog.findUnique({ where: { id: audit.id } })).resolves.toMatchObject({
      actorUserId: null,
      targetId: user.id
    });
  });
});
