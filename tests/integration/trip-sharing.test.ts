import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  generateTripShareToken,
  hashTripShareToken,
  resolveTripShareSummary
} from "@/lib/trip-sharing";

const testRun = Date.now();
let createdUserId: string | null = null;

afterAll(async () => {
  if (createdUserId) {
    await prisma.trip.deleteMany({ where: { ownerId: createdUserId } });
    await prisma.user.delete({ where: { id: createdUserId } });
  }
  await prisma.$disconnect();
});

describe("read-only trip sharing", () => {
  it("returns only allowed cost data and invalidates expired, revoked, and rotated tokens", async () => {
    const owner = await prisma.user.create({
      data: {
        username: `share-owner-${testRun}`,
        email: `share-owner-${testRun}@seddleup.test`,
        passwordHash: await bcrypt.hash("TestPass123", 12),
        paymentMethods: {
          create: {
            provider: "venmo",
            handle: "private-payment-handle",
            url: "https://example.com/private-payment-link",
            notes: "private payment notes"
          }
        }
      }
    });
    createdUserId = owner.id;
    const trip = await prisma.trip.create({
      data: {
        name: "Shareable Costs",
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: "owner" } },
        participants: {
          create: [
            { name: "Alice Private", email: "alice-private@example.com", userId: owner.id },
            { name: "Bob Private", email: "bob-private@example.com" }
          ]
        }
      },
      include: { participants: true }
    });
    const [alice, bob] = trip.participants;
    await prisma.expense.create({
      data: {
        title: "Included dinner",
        amount: new Prisma.Decimal(60),
        category: "Food",
        date: new Date("2026-07-10T00:00:00Z"),
        notes: "private expense notes",
        status: "submitted",
        payerId: alice.id,
        tripId: trip.id,
        createdByUserId: owner.id,
        shares: {
          create: [
            { participantId: alice.id, shareAmount: new Prisma.Decimal(30) },
            { participantId: bob.id, shareAmount: new Prisma.Decimal(30) }
          ]
        }
      }
    });
    const draft = await prisma.expense.create({
      data: {
        title: "Secret draft expense",
        amount: new Prisma.Decimal(900),
        category: "Other",
        date: new Date("2026-07-11T00:00:00Z"),
        notes: "secret draft notes",
        status: "draft",
        payerId: bob.id,
        tripId: trip.id,
        createdByUserId: owner.id
      }
    });
    await prisma.receipt.create({
      data: {
        originalFilename: "private-receipt.pdf",
        storedFilename: "stored-private.pdf",
        storedPath: "/private/receipt/path",
        mimeType: "application/pdf",
        fileSize: 123,
        rawText: "private raw receipt text",
        parsedJson: '{"private":"parser output"}',
        tripId: trip.id,
        expenseId: draft.id,
        uploaderUserId: owner.id
      }
    });
    await prisma.tripPayment.create({
      data: {
        tripId: trip.id,
        senderParticipantId: bob.id,
        recipientParticipantId: alice.id,
        amount: new Prisma.Decimal(10),
        date: new Date("2026-07-12T00:00:00Z"),
        note: "private settlement note",
        confirmedByUserId: owner.id,
        confirmedAt: new Date("2026-07-12T01:00:00Z")
      }
    });

    const token = generateTripShareToken();
    const link = await prisma.tripShareLink.create({
      data: {
        tripId: trip.id,
        tokenHash: hashTripShareToken(token),
        participantNameMode: "anonymized",
        createdByUserId: owner.id,
        expiresAt: new Date("2099-01-01T00:00:00Z")
      }
    });

    const summary = await resolveTripShareSummary(token, new Date("2026-07-14T00:00:00Z"));
    expect(summary).toMatchObject({
      trip: { name: "Shareable Costs", currency: "USD" },
      totalCost: 60,
      expenses: [{ title: "Included dinner", payerName: "Traveler 1" }]
    });
    expect(summary?.balances.map((balance) => balance.participantName)).toEqual([
      "Traveler 1",
      "Traveler 2"
    ]);
    expect(summary?.balances.map((balance) => balance.net)).toEqual([30, -30]);
    const exposed = JSON.stringify(summary);
    expect(exposed).not.toContain("tripPayment");
    expect(exposed).not.toContain("confirmedBy");
    for (const sensitiveValue of [
      owner.email,
      alice.id,
      bob.id,
      "Alice Private",
      "Bob Private",
      "Secret draft expense",
      "private expense notes",
      "private-receipt.pdf",
      "private raw receipt text",
      "private-payment-handle",
      "private-payment-link",
      "private settlement note"
    ]) {
      expect(exposed).not.toContain(sensitiveValue);
    }

    expect(await resolveTripShareSummary("invalid-token")).toBeNull();

    await prisma.tripShareLink.update({
      where: { id: link.id },
      data: { expiresAt: new Date("2026-01-01T00:00:00Z") }
    });
    expect(await resolveTripShareSummary(token, new Date("2026-07-14T00:00:00Z"))).toBeNull();

    const rotatedToken = generateTripShareToken();
    await prisma.tripShareLink.update({
      where: { id: link.id },
      data: {
        tokenHash: hashTripShareToken(rotatedToken),
        expiresAt: null,
        revokedAt: null
      }
    });
    expect(await resolveTripShareSummary(token)).toBeNull();
    expect(await resolveTripShareSummary(rotatedToken)).not.toBeNull();

    await prisma.tripShareLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() }
    });
    expect(await resolveTripShareSummary(rotatedToken)).toBeNull();
  });
});
