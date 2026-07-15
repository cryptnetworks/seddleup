import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { calculateBalances } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

const testRun = Date.now();
const createdUserIds: string[] = [];

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: {
      username: `collab-${label}-${testRun}`,
      email: `collab-${label}-${testRun}@triptally.test`,
      passwordHash: await bcrypt.hash("TestPass123", 12)
    }
  });
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.trip.deleteMany({ where: { ownerId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("collaborative expense model", () => {
  it("tracks trip membership, expense ownership, status, and audit records", async () => {
    const owner = await createUser("owner");
    const member = await createUser("member");
    const trip = await prisma.trip.create({
      data: {
        name: "Collaborative Trip",
        ownerId: owner.id,
        members: {
          create: [
            { userId: owner.id, role: "owner" },
            { userId: member.id, role: "member" }
          ]
        },
        participants: {
          create: [
            { name: "Owner", email: owner.email, userId: owner.id },
            { name: "Member", email: member.email, userId: member.id }
          ]
        }
      },
      include: { participants: true, members: true }
    });

    const ownerParticipant = trip.participants.find(
      (participant) => participant.userId === owner.id
    );
    const memberParticipant = trip.participants.find(
      (participant) => participant.userId === member.id
    );
    expect(ownerParticipant).toBeTruthy();
    expect(memberParticipant).toBeTruthy();

    const expense = await prisma.expense.create({
      data: {
        title: "Groceries",
        amount: new Prisma.Decimal(40),
        category: "Food",
        date: new Date("2026-08-01T00:00:00Z"),
        payerId: memberParticipant!.id,
        tripId: trip.id,
        createdByUserId: member.id,
        paidByUserId: member.id,
        updatedByUserId: member.id,
        status: "submitted",
        shares: {
          create: [
            { participantId: ownerParticipant!.id, shareAmount: new Prisma.Decimal(20) },
            { participantId: memberParticipant!.id, shareAmount: new Prisma.Decimal(20) }
          ]
        }
      },
      include: { shares: true }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: member.id,
        tripId: trip.id,
        action: "expense.create",
        targetType: "expense",
        targetId: expense.id,
        entityType: "expense",
        entityId: expense.id,
        afterJson: JSON.stringify({ status: expense.status })
      }
    });

    const auditCount = await prisma.auditLog.count({
      where: { tripId: trip.id, entityType: "expense", entityId: expense.id }
    });
    expect(auditCount).toBe(1);

    const reloadedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
      include: {
        participants: true,
        expenses: {
          where: { status: { not: "draft" } },
          include: { shares: true }
        }
      }
    });
    const { balances } = calculateBalances(reloadedTrip.participants, reloadedTrip.expenses);

    expect(balances).toEqual([
      expect.objectContaining({ participant: ownerParticipant, paid: 0, owed: 20, net: -20 }),
      expect.objectContaining({ participant: memberParticipant, paid: 40, owed: 20, net: 20 })
    ]);
  });
});
