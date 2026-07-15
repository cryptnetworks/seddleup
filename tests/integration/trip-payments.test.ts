import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { calculateBalances } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import {
  confirmTripPaymentForUser,
  deleteConfirmedTripPaymentForUser,
  editConfirmedTripPaymentForUser
} from "@/lib/trip-payments";

const run = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const userIds: string[] = [];

async function createUser(label: string, role = "user") {
  const user = await prisma.user.create({
    data: {
      username: `payment-${label}-${run}`,
      email: `payment-${label}-${run}@seddleup.test`,
      passwordHash: "integration-test-only",
      role
    }
  });
  userIds.push(user.id);
  return user;
}

async function createScenario(label: string) {
  const [owner, creditor, debtor, admin, unrelated, viewer] = await Promise.all([
    createUser(`${label}-owner`),
    createUser(`${label}-creditor`),
    createUser(`${label}-debtor`),
    createUser(`${label}-admin`, "admin"),
    createUser(`${label}-unrelated`),
    createUser(`${label}-viewer`)
  ]);
  const trip = await prisma.trip.create({
    data: {
      name: `Settlement ${label}`,
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: "owner" },
          { userId: creditor.id, role: "member" },
          { userId: debtor.id, role: "member" },
          { userId: admin.id, role: "admin" },
          { userId: unrelated.id, role: "member" },
          { userId: viewer.id, role: "viewer" }
        ]
      },
      participants: {
        create: [
          { name: "Alice", userId: creditor.id, email: creditor.email },
          { name: "Bob", userId: debtor.id, email: debtor.email },
          { name: "Alice", email: creditor.email }
        ]
      }
    },
    include: { participants: true }
  });
  const creditorParticipant = trip.participants.find((item) => item.userId === creditor.id)!;
  const debtorParticipant = trip.participants.find((item) => item.userId === debtor.id)!;
  const unlinkedLookalike = trip.participants.find((item) => item.userId === null)!;
  const expense = await prisma.expense.create({
    data: {
      title: "Hotel",
      amount: new Prisma.Decimal(100),
      category: "Lodging",
      date: new Date("2026-07-01T00:00:00"),
      payerId: creditorParticipant.id,
      tripId: trip.id,
      createdByUserId: creditor.id,
      shares: {
        create: [
          { participantId: creditorParticipant.id, shareAmount: new Prisma.Decimal(50) },
          { participantId: debtorParticipant.id, shareAmount: new Prisma.Decimal(50) }
        ]
      }
    },
    include: { shares: true }
  });
  return {
    owner,
    creditor,
    debtor,
    admin,
    unrelated,
    viewer,
    trip,
    creditorParticipant,
    debtorParticipant,
    unlinkedLookalike,
    expense
  };
}

function confirmationInput(scenario: Awaited<ReturnType<typeof createScenario>>, amount = 20) {
  return {
    senderParticipantId: scenario.debtorParticipant.id,
    recipientParticipantId: scenario.creditorParticipant.id,
    amount,
    date: "2026-07-02",
    note: "private confirmation note"
  };
}

async function ledgerFor(tripId: string) {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { participants: true, expenses: { include: { shares: true } }, payments: true }
  });
  return calculateBalances(trip.participants, trip.expenses, trip.payments);
}

afterAll(async () => {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("creditor-confirmed trip payments", () => {
  it("allows the linked creditor to confirm partial and complete payments", async () => {
    const scenario = await createScenario("partial-full");
    const partial = await confirmTripPaymentForUser(
      scenario.trip.id,
      scenario.creditor.id,
      confirmationInput(scenario, 20)
    );
    expect(partial.ok).toBe(true);
    expect((await ledgerFor(scenario.trip.id)).balances.map((balance) => balance.net)).toEqual([
      30, -30, 0
    ]);

    const complete = await confirmTripPaymentForUser(
      scenario.trip.id,
      scenario.creditor.id,
      confirmationInput(scenario, 30)
    );
    expect(complete.ok).toBe(true);
    expect((await ledgerFor(scenario.trip.id)).settlements).toEqual([]);

    const payments = await prisma.tripPayment.findMany({ where: { tripId: scenario.trip.id } });
    expect(payments).toHaveLength(2);
    expect(payments.every((payment) => payment.confirmedByUserId === scenario.creditor.id)).toBe(
      true
    );
    expect(payments.every((payment) => payment.confirmedAt instanceof Date)).toBe(true);
    const audit = await prisma.auditLog.findFirst({
      where: { tripId: scenario.trip.id, action: "trip_payment.confirm" },
      orderBy: { createdAt: "desc" }
    });
    expect(audit?.afterJson).not.toContain("private confirmation note");
  });

  it("denies debtors, elevated non-creditors, unrelated users, viewers, and unlinked lookalikes", async () => {
    const scenario = await createScenario("permissions");
    const input = confirmationInput(scenario, 20);
    for (const userId of [
      scenario.debtor.id,
      scenario.owner.id,
      scenario.admin.id,
      scenario.unrelated.id
    ]) {
      await expect(confirmTripPaymentForUser(scenario.trip.id, userId, input)).resolves.toEqual({
        ok: false,
        reason: "forbidden"
      });
    }

    await prisma.tripMember.update({
      where: {
        tripId_userId: { tripId: scenario.trip.id, userId: scenario.creditor.id }
      },
      data: { role: "viewer" }
    });
    await expect(
      confirmTripPaymentForUser(scenario.trip.id, scenario.creditor.id, input)
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    await prisma.tripMember.update({
      where: {
        tripId_userId: { tripId: scenario.trip.id, userId: scenario.creditor.id }
      },
      data: { role: "member" }
    });
    await expect(
      confirmTripPaymentForUser(scenario.trip.id, scenario.creditor.id, {
        ...input,
        recipientParticipantId: scenario.unlinkedLookalike.id
      })
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    await prisma.participant.update({
      where: { id: scenario.creditorParticipant.id },
      data: { userId: null }
    });
    await expect(
      confirmTripPaymentForUser(scenario.trip.id, scenario.creditor.id, {
        ...input,
        recipientParticipantId: scenario.creditorParticipant.id
      })
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    expect(scenario.unlinkedLookalike.email).toBe(scenario.creditor.email);
  });

  it("rejects cross-trip participants, stale suggestions, overpayments, and repeated submissions", async () => {
    const scenario = await createScenario("stale");
    const other = await createScenario("other-trip");
    await expect(
      confirmTripPaymentForUser(scenario.trip.id, scenario.creditor.id, {
        ...confirmationInput(scenario),
        senderParticipantId: other.debtorParticipant.id
      })
    ).resolves.toEqual({ ok: false, reason: "participants" });
    await expect(
      confirmTripPaymentForUser(
        scenario.trip.id,
        scenario.creditor.id,
        confirmationInput(scenario, 50.01)
      )
    ).resolves.toEqual({ ok: false, reason: "stale" });

    const attempts = await Promise.all([
      confirmTripPaymentForUser(
        scenario.trip.id,
        scenario.creditor.id,
        confirmationInput(scenario, 40)
      ),
      confirmTripPaymentForUser(
        scenario.trip.id,
        scenario.creditor.id,
        confirmationInput(scenario, 40)
      )
    ]);
    expect(attempts.filter((result) => result.ok)).toHaveLength(1);
    expect(attempts.filter((result) => !result.ok)).toHaveLength(1);
    expect(
      Number(
        (
          await prisma.tripPayment.aggregate({
            where: { tripId: scenario.trip.id },
            _sum: { amount: true }
          })
        )._sum.amount
      )
    ).toBe(40);
    await expect(
      confirmTripPaymentForUser(
        scenario.trip.id,
        scenario.creditor.id,
        confirmationInput(scenario, 20)
      )
    ).resolves.toEqual({ ok: false, reason: "stale" });
  });

  it("allows only the confirming creditor to edit details or delete the confirmation", async () => {
    const scenario = await createScenario("manage");
    const confirmed = await confirmTripPaymentForUser(
      scenario.trip.id,
      scenario.creditor.id,
      confirmationInput(scenario, 20)
    );
    if (!confirmed.ok) throw new Error("Expected payment confirmation to succeed");

    for (const userId of [scenario.debtor.id, scenario.owner.id, scenario.admin.id]) {
      await expect(
        editConfirmedTripPaymentForUser(scenario.trip.id, confirmed.value.paymentId, userId, {
          date: "2026-07-03",
          note: "not allowed"
        })
      ).resolves.toEqual({ ok: false, reason: "forbidden" });
      await expect(
        deleteConfirmedTripPaymentForUser(scenario.trip.id, confirmed.value.paymentId, userId)
      ).resolves.toEqual({ ok: false, reason: "forbidden" });
    }

    await expect(
      editConfirmedTripPaymentForUser(
        scenario.trip.id,
        confirmed.value.paymentId,
        scenario.creditor.id,
        { date: "2026-07-03", note: "corrected private note" }
      )
    ).resolves.toEqual({ ok: true, value: { paymentId: confirmed.value.paymentId } });
    const edited = await prisma.tripPayment.findUniqueOrThrow({
      where: { id: confirmed.value.paymentId }
    });
    expect(Number(edited.amount)).toBe(20);
    expect(edited.date.getDate()).toBe(3);

    await expect(
      deleteConfirmedTripPaymentForUser(
        scenario.trip.id,
        confirmed.value.paymentId,
        scenario.creditor.id
      )
    ).resolves.toEqual({ ok: true, value: { paymentId: confirmed.value.paymentId } });
    expect((await ledgerFor(scenario.trip.id)).balances.map((balance) => balance.net)).toEqual([
      50, -50, 0
    ]);
  });

  it("enforces creditor identity, same-trip parties, immutable amounts, and participant retention in SQLite", async () => {
    const scenario = await createScenario("database");
    await expect(
      prisma.tripPayment.create({
        data: {
          tripId: scenario.trip.id,
          senderParticipantId: scenario.debtorParticipant.id,
          recipientParticipantId: scenario.creditorParticipant.id,
          amount: new Prisma.Decimal(1),
          date: new Date(),
          confirmedByUserId: scenario.debtor.id
        }
      })
    ).rejects.toThrow();

    const confirmed = await confirmTripPaymentForUser(
      scenario.trip.id,
      scenario.creditor.id,
      confirmationInput(scenario, 20)
    );
    if (!confirmed.ok) throw new Error("Expected payment confirmation to succeed");
    await expect(
      prisma.tripPayment.update({
        where: { id: confirmed.value.paymentId },
        data: { amount: new Prisma.Decimal(1) }
      })
    ).rejects.toThrow();
    await expect(
      prisma.participant.delete({ where: { id: scenario.debtorParticipant.id } })
    ).rejects.toThrow();
  });
});
