import type { Prisma } from "@prisma/client";

export class OwnershipTransferError extends Error {
  constructor(
    public readonly reason:
      | "trip-not-found"
      | "replacement-not-found"
      | "replacement-disabled"
      | "replacement-readonly"
      | "same-owner"
      | "ownership-changed"
  ) {
    super(reason);
    this.name = "OwnershipTransferError";
  }
}

export async function transferTripOwnershipInTransaction(
  client: Prisma.TransactionClient,
  input: { tripId: string; replacementOwnerId: string; expectedOwnerId?: string }
) {
  const [trip, replacement] = await Promise.all([
    client.trip.findUnique({ where: { id: input.tripId }, select: { id: true, ownerId: true } }),
    client.user.findUnique({
      where: { id: input.replacementOwnerId },
      select: { id: true, role: true, disabledAt: true }
    })
  ]);

  if (!trip) throw new OwnershipTransferError("trip-not-found");
  if (!replacement) throw new OwnershipTransferError("replacement-not-found");
  if (replacement.disabledAt) throw new OwnershipTransferError("replacement-disabled");
  if (replacement.role === "readonly") throw new OwnershipTransferError("replacement-readonly");
  if (input.expectedOwnerId && trip.ownerId !== input.expectedOwnerId) {
    throw new OwnershipTransferError("ownership-changed");
  }
  if (trip.ownerId === replacement.id) throw new OwnershipTransferError("same-owner");

  const transferred = await client.trip.updateMany({
    where: { id: trip.id, ownerId: trip.ownerId },
    data: { ownerId: replacement.id }
  });
  if (transferred.count !== 1) throw new OwnershipTransferError("ownership-changed");

  await client.tripMember.upsert({
    where: { tripId_userId: { tripId: trip.id, userId: replacement.id } },
    update: { role: "owner" },
    create: { tripId: trip.id, userId: replacement.id, role: "owner" }
  });
  await client.tripMember.updateMany({
    where: { tripId: trip.id, userId: trip.ownerId, role: "owner" },
    data: { role: "admin" }
  });
  return { tripId: trip.id, previousOwnerId: trip.ownerId, replacementOwnerId: replacement.id };
}
