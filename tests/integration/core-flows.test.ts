import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { calculateEqualShares } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

const testRun = Date.now();
const createdUserIds: string[] = [];

async function createTestUser(label: string) {
  const user = await prisma.user.create({
    data: {
      username: `int-${label}-${testRun}`,
      email: `int-${label}-${testRun}@triptally.test`,
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

describe("auth integration", () => {
  it("stores hashed passwords that can be verified", async () => {
    const user = await createTestUser("auth");

    expect(user.passwordHash).not.toBe("TestPass123");
    await expect(bcrypt.compare("TestPass123", user.passwordHash)).resolves.toBe(true);
  });
});

describe("trip CRUD integration", () => {
  it("creates, updates, and deletes a trip owned by a user", async () => {
    const user = await createTestUser("trip");
    const trip = await prisma.trip.create({
      data: {
        name: "Integration Trip",
        destination: "Boston",
        ownerId: user.id
      }
    });

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { destination: "Providence" }
    });

    expect(updated.destination).toBe("Providence");

    await prisma.trip.delete({ where: { id: trip.id } });
    await expect(prisma.trip.findUnique({ where: { id: trip.id } })).resolves.toBeNull();
  });
});

describe("expense CRUD integration", () => {
  it("creates, updates, and deletes an expense with equal shares", async () => {
    const user = await createTestUser("expense");
    const trip = await prisma.trip.create({
      data: {
        name: "Expense Trip",
        ownerId: user.id,
        participants: {
          create: [{ name: "Alice" }, { name: "Bob" }]
        }
      },
      include: { participants: true }
    });

    const [alice, bob] = trip.participants;
    const shares = calculateEqualShares(21.01, 2);
    const expense = await prisma.expense.create({
      data: {
        title: "Lunch",
        amount: new Prisma.Decimal(21.01),
        category: "Food",
        date: new Date("2026-07-02T00:00:00Z"),
        payerId: alice.id,
        tripId: trip.id,
        shares: {
          create: [
            { participantId: alice.id, shareAmount: new Prisma.Decimal(shares[0]) },
            { participantId: bob.id, shareAmount: new Prisma.Decimal(shares[1]) }
          ]
        }
      },
      include: { shares: true }
    });

    expect(expense.shares).toHaveLength(2);
    expect(expense.shares.reduce((sum, share) => sum + Number(share.shareAmount), 0)).toBeCloseTo(
      21.01,
      2
    );

    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: { title: "Team Lunch" }
    });

    expect(updated.title).toBe("Team Lunch");

    await prisma.expense.delete({ where: { id: expense.id } });
    await expect(prisma.expense.findUnique({ where: { id: expense.id } })).resolves.toBeNull();
  });
});
