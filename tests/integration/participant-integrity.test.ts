import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import {
  hasParticipantFinancialDependencies,
  participantFinancialDependencies
} from "@/lib/participant-integrity";
import { prisma } from "@/lib/prisma";

const testRun = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const createdUserIds: string[] = [];

async function createTripFixture(label: string) {
  const user = await prisma.user.create({
    data: {
      username: `participant-integrity-${label}-${testRun}`,
      email: `participant-integrity-${label}-${testRun}@example.test`,
      passwordHash: await bcrypt.hash("TestPass123", 4)
    }
  });
  createdUserIds.push(user.id);
  const trip = await prisma.trip.create({
    data: {
      name: `Participant integrity ${label}`,
      ownerId: user.id,
      participants: { create: [{ name: "Referenced" }, { name: "Unreferenced" }] }
    },
    include: { participants: true }
  });
  return { user, trip, referenced: trip.participants[0], unreferenced: trip.participants[1] };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("participant deletion integrity", () => {
  it("deletes a participant with no financial dependencies", async () => {
    const fixture = await createTripFixture("empty");
    expect(
      hasParticipantFinancialDependencies(
        await participantFinancialDependencies(prisma, fixture.unreferenced.id)
      )
    ).toBe(false);

    await prisma.participant.delete({ where: { id: fixture.unreferenced.id } });
    await expect(
      prisma.participant.findUnique({ where: { id: fixture.unreferenced.id } })
    ).resolves.toBeNull();
  });

  it("restricts deletion when the participant paid an expense", async () => {
    const fixture = await createTripFixture("payer");
    const expense = await prisma.expense.create({
      data: {
        title: "Protected expense",
        amount: new Prisma.Decimal("10.00"),
        category: "Food",
        date: new Date(),
        payerId: fixture.referenced.id,
        tripId: fixture.trip.id
      }
    });

    await expect(
      prisma.participant.delete({ where: { id: fixture.referenced.id } })
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(prisma.expense.findUnique({ where: { id: expense.id } })).resolves.not.toBeNull();
  });

  it("restricts deletion when the participant owns an expense share", async () => {
    const fixture = await createTripFixture("share");
    const expense = await prisma.expense.create({
      data: {
        title: "Shared expense",
        amount: new Prisma.Decimal("10.00"),
        category: "Food",
        date: new Date(),
        payerId: fixture.unreferenced.id,
        tripId: fixture.trip.id,
        shares: {
          create: { participantId: fixture.referenced.id, shareAmount: new Prisma.Decimal("10.00") }
        }
      }
    });

    const dependencies = await participantFinancialDependencies(prisma, fixture.referenced.id);
    expect(dependencies).toMatchObject({ expensesPaid: 0, expenseShares: 1 });
    await expect(
      prisma.participant.delete({ where: { id: fixture.referenced.id } })
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(prisma.expense.findUnique({ where: { id: expense.id } })).resolves.not.toBeNull();
  });

  it("restricts deletion when a receipt line item is assigned", async () => {
    const fixture = await createTripFixture("receipt");
    await prisma.receipt.create({
      data: {
        id: `receipt-${testRun}`,
        originalFilename: "fixture.pdf",
        storedFilename: "original.pdf",
        storedPath: `/tmp/test-receipts/${testRun}/original.pdf`,
        mimeType: "application/pdf",
        fileSize: 1,
        tripId: fixture.trip.id,
        uploaderUserId: fixture.user.id,
        lineItems: {
          create: {
            name: "Line item",
            totalPrice: new Prisma.Decimal("4.00"),
            participants: {
              create: { participantId: fixture.referenced.id, role: "assigned" }
            }
          }
        }
      }
    });

    const dependencies = await participantFinancialDependencies(prisma, fixture.referenced.id);
    expect(dependencies).toMatchObject({ receiptAssignments: 1 });
    await expect(
      prisma.participant.delete({ where: { id: fixture.referenced.id } })
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
