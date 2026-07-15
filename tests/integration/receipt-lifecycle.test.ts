import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

const testRun = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let userId: string | undefined;

afterAll(async () => {
  if (userId) {
    await prisma.trip.deleteMany({ where: { ownerId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
});

describe("receipt database lifecycle", () => {
  it("preserves and detaches a receipt when its expense is deleted", async () => {
    const user = await prisma.user.create({
      data: {
        username: `receipt-lifecycle-${testRun}`,
        email: `receipt-lifecycle-${testRun}@example.test`,
        passwordHash: await bcrypt.hash("TestPass123", 4)
      }
    });
    userId = user.id;
    const trip = await prisma.trip.create({
      data: {
        name: "Receipt lifecycle",
        ownerId: user.id,
        participants: { create: { name: "Payer" } }
      },
      include: { participants: true }
    });
    const expense = await prisma.expense.create({
      data: {
        title: "Expense with receipt",
        amount: new Prisma.Decimal("8.00"),
        category: "Food",
        date: new Date(),
        tripId: trip.id,
        payerId: trip.participants[0].id
      }
    });
    const receipt = await prisma.receipt.create({
      data: {
        originalFilename: "fixture.pdf",
        storedFilename: "original.pdf",
        storedPath: `/tmp/test-receipts/${testRun}/original.pdf`,
        mimeType: "application/pdf",
        fileSize: 1,
        tripId: trip.id,
        expenseId: expense.id,
        uploaderUserId: user.id
      }
    });

    await prisma.expense.delete({ where: { id: expense.id } });

    await expect(prisma.receipt.findUnique({ where: { id: receipt.id } })).resolves.toMatchObject({
      id: receipt.id,
      expenseId: null,
      tripId: trip.id
    });
  });
});
