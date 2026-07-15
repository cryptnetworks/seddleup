import type { Prisma } from "@prisma/client";

export class OwnershipTransferError extends Error {
  constructor(
    public readonly reason:
      | "trip-not-found"
      | "replacement-not-found"
      | "replacement-disabled"
      | "replacement-readonly"
      | "same-owner"
  ) {
    super(reason);
    this.name = "OwnershipTransferError";
  }
}

export async function transferTripOwnershipInTransaction(
  client: Prisma.TransactionClient,
  input: { tripId: string; replacementOwnerId: string }
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
  if (trip.ownerId === replacement.id) throw new OwnershipTransferError("same-owner");

  await client.tripMember.upsert({
    where: { tripId_userId: { tripId: trip.id, userId: replacement.id } },
    update: { role: "owner" },
    create: { tripId: trip.id, userId: replacement.id, role: "owner" }
  });
  await client.tripMember.updateMany({
    where: { tripId: trip.id, userId: trip.ownerId, role: "owner" },
    data: { role: "admin" }
  });
  await client.trip.update({
    where: { id: trip.id },
    data: { ownerId: replacement.id }
  });

  return { tripId: trip.id, previousOwnerId: trip.ownerId, replacementOwnerId: replacement.id };
}
