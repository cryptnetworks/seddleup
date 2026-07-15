import { Prisma, type PrismaClient } from "@prisma/client";
import { calculateBalances, roundCurrency } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import {
  canConfirmTripPayment,
  canDeleteConfirmedTripPayment,
  canEditConfirmedTripPayment,
  normalizeTripRole,
  type TripRole
} from "@/lib/trip-permissions";
import type { TripPaymentConfirmationData, TripPaymentEditData } from "@/lib/validation";

export type TripPaymentMutationFailure = "forbidden" | "participants" | "not-found" | "stale";

type TripPaymentMutationResult<T> =
  { ok: true; value: T } | { ok: false; reason: TripPaymentMutationFailure };

function tripRole(
  trip: { ownerId: string; members: { role: string; userId: string }[] },
  userId: string
): TripRole | null {
  if (trip.ownerId === userId) return "owner";
  const membership = trip.members.find((member) => member.userId === userId);
  return membership ? normalizeTripRole(membership.role) : null;
}

function amountInCents(amount: number) {
  return Math.round(roundCurrency(amount) * 100);
}

function paymentSnapshot(payment: {
  amount: unknown;
  date: Date;
  senderParticipantId: string;
  recipientParticipantId: string;
  confirmedByUserId: string | null;
  confirmedAt: Date;
}) {
  return {
    amount: Number(payment.amount),
    date: payment.date.toISOString(),
    senderParticipantId: payment.senderParticipantId,
    recipientParticipantId: payment.recipientParticipantId,
    confirmedByUserId: payment.confirmedByUserId,
    confirmedAt: payment.confirmedAt.toISOString()
  };
}

function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("database is locked") || message.includes("sqlite_busy");
}

export async function confirmTripPaymentForUser(
  tripId: string,
  userId: string,
  input: TripPaymentConfirmationData,
  client: PrismaClient = prisma
): Promise<TripPaymentMutationResult<{ paymentId: string }>> {
  try {
    return await client.$transaction(
      async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id: tripId },
          select: {
            ownerId: true,
            settlementRevision: true,
            members: { where: { userId }, select: { role: true, userId: true } },
            participants: {
              orderBy: { createdAt: "asc" },
              select: { id: true, name: true, userId: true }
            },
            expenses: {
              where: { status: { not: "draft" } },
              select: {
                amount: true,
                payerId: true,
                shares: { select: { participantId: true, shareAmount: true } }
              }
            },
            payments: {
              select: { amount: true, senderParticipantId: true, recipientParticipantId: true }
            }
          }
        });
        if (!trip) return { ok: false, reason: "not-found" } as const;

        const role = tripRole(trip, userId);
        if (!role) return { ok: false, reason: "forbidden" } as const;
        const sender = trip.participants.find(
          (participant) => participant.id === input.senderParticipantId
        );
        const recipient = trip.participants.find(
          (participant) => participant.id === input.recipientParticipantId
        );
        if (!sender || !recipient) return { ok: false, reason: "participants" } as const;
        if (
          !canConfirmTripPayment(role, userId, {
            senderParticipantId: sender.id,
            recipientParticipantId: recipient.id,
            recipientParticipantUserId: recipient.userId
          })
        ) {
          return { ok: false, reason: "forbidden" } as const;
        }

        const { settlements } = calculateBalances(trip.participants, trip.expenses, trip.payments);
        const currentSettlement = settlements.find(
          (settlement) =>
            settlement.debtorId === sender.id && settlement.creditorId === recipient.id
        );
        const submittedCents = amountInCents(input.amount);
        if (
          !currentSettlement ||
          submittedCents <= 0 ||
          submittedCents > amountInCents(currentSettlement.amount)
        ) {
          return { ok: false, reason: "stale" } as const;
        }

        const revision = await tx.trip.updateMany({
          where: { id: tripId, settlementRevision: trip.settlementRevision },
          data: { settlementRevision: { increment: 1 } }
        });
        if (revision.count !== 1) return { ok: false, reason: "stale" } as const;

        const confirmedAt = new Date();
        const payment = await tx.tripPayment.create({
          data: {
            tripId,
            senderParticipantId: sender.id,
            recipientParticipantId: recipient.id,
            amount: new Prisma.Decimal((submittedCents / 100).toFixed(2)),
            date: new Date(`${input.date}T00:00:00`),
            note: input.note || null,
            confirmedByUserId: userId,
            confirmedAt
          }
        });
        await tx.auditLog.create({
          data: {
            actorUserId: userId,
            tripId,
            action: "trip_payment.confirm",
            targetType: "trip_payment",
            targetId: payment.id,
            entityType: "trip_payment",
            entityId: payment.id,
            afterJson: JSON.stringify(paymentSnapshot(payment))
          }
        });
        return { ok: true, value: { paymentId: payment.id } } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (isTransactionConflict(error)) return { ok: false, reason: "stale" };
    throw error;
  }
}

export async function editConfirmedTripPaymentForUser(
  tripId: string,
  paymentId: string,
  userId: string,
  input: TripPaymentEditData,
  client: PrismaClient = prisma
): Promise<TripPaymentMutationResult<{ paymentId: string }>> {
  return client.$transaction(
    async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          ownerId: true,
          members: { where: { userId }, select: { role: true, userId: true } }
        }
      });
      if (!trip) return { ok: false, reason: "not-found" } as const;
      const role = tripRole(trip, userId);
      if (!role) return { ok: false, reason: "forbidden" } as const;

      const existing = await tx.tripPayment.findFirst({
        where: { id: paymentId, tripId },
        include: { recipient: { select: { userId: true } } }
      });
      if (!existing) return { ok: false, reason: "not-found" } as const;
      if (
        !canEditConfirmedTripPayment(role, userId, {
          confirmedByUserId: existing.confirmedByUserId,
          recipientParticipantUserId: existing.recipient.userId
        })
      ) {
        return { ok: false, reason: "forbidden" } as const;
      }

      const payment = await tx.tripPayment.update({
        where: { id: paymentId },
        data: {
          date: new Date(`${input.date}T00:00:00`),
          note: input.note || null
        }
      });
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          tripId,
          action: "trip_payment.update",
          targetType: "trip_payment",
          targetId: payment.id,
          entityType: "trip_payment",
          entityId: payment.id,
          beforeJson: JSON.stringify(paymentSnapshot(existing)),
          afterJson: JSON.stringify(paymentSnapshot(payment))
        }
      });
      return { ok: true, value: { paymentId: payment.id } } as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function deleteConfirmedTripPaymentForUser(
  tripId: string,
  paymentId: string,
  userId: string,
  client: PrismaClient = prisma
): Promise<TripPaymentMutationResult<{ paymentId: string }>> {
  try {
    return await client.$transaction(
      async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id: tripId },
          select: {
            ownerId: true,
            settlementRevision: true,
            members: { where: { userId }, select: { role: true, userId: true } }
          }
        });
        if (!trip) return { ok: false, reason: "not-found" } as const;
        const role = tripRole(trip, userId);
        if (!role) return { ok: false, reason: "forbidden" } as const;

        const existing = await tx.tripPayment.findFirst({
          where: { id: paymentId, tripId },
          include: { recipient: { select: { userId: true } } }
        });
        if (!existing) return { ok: false, reason: "not-found" } as const;
        if (
          !canDeleteConfirmedTripPayment(role, userId, {
            confirmedByUserId: existing.confirmedByUserId,
            recipientParticipantUserId: existing.recipient.userId
          })
        ) {
          return { ok: false, reason: "forbidden" } as const;
        }

        const revision = await tx.trip.updateMany({
          where: { id: tripId, settlementRevision: trip.settlementRevision },
          data: { settlementRevision: { increment: 1 } }
        });
        if (revision.count !== 1) return { ok: false, reason: "stale" } as const;

        await tx.tripPayment.delete({ where: { id: paymentId } });
        await tx.auditLog.create({
          data: {
            actorUserId: userId,
            tripId,
            action: "trip_payment.delete",
            targetType: "trip_payment",
            targetId: paymentId,
            entityType: "trip_payment",
            entityId: paymentId,
            beforeJson: JSON.stringify(paymentSnapshot(existing))
          }
        });
        return { ok: true, value: { paymentId } } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (isTransactionConflict(error)) return { ok: false, reason: "stale" };
    throw error;
  }
}
