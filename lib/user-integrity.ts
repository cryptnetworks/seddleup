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
  input: { tripId: string; replacementOwnerId: string; expectedOwnerId: string }
) {
  // Make the first SQLite operation a conditional write. This claims the
  // expected owner snapshot before any reads and avoids a deferred transaction
  // failing when it later tries to upgrade from reader to writer.
  const claimed = await client.trip.updateMany({
    where: { id: input.tripId, ownerId: input.expectedOwnerId },
    data: { ownerId: input.expectedOwnerId }
  });
  if (claimed.count !== 1) throw new OwnershipTransferError("ownership-changed");

  const replacement = await client.user.findUnique({
    where: { id: input.replacementOwnerId },
    select: { id: true, role: true, disabledAt: true }
  });
  if (!replacement) throw new OwnershipTransferError("replacement-not-found");
  if (replacement.disabledAt) throw new OwnershipTransferError("replacement-disabled");
  if (replacement.role === "readonly") throw new OwnershipTransferError("replacement-readonly");
  if (input.expectedOwnerId === replacement.id) throw new OwnershipTransferError("same-owner");

  const transferred = await client.trip.updateMany({
    where: { id: input.tripId, ownerId: input.expectedOwnerId },
    data: { ownerId: replacement.id }
  });
  if (transferred.count !== 1) throw new OwnershipTransferError("ownership-changed");

  await client.tripMember.upsert({
    where: { tripId_userId: { tripId: input.tripId, userId: replacement.id } },
    update: { role: "owner" },
    create: { tripId: input.tripId, userId: replacement.id, role: "owner" }
  });
  await client.tripMember.updateMany({
    where: { tripId: input.tripId, userId: input.expectedOwnerId, role: "owner" },
    data: { role: "admin" }
  });
  return {
    tripId: input.tripId,
    previousOwnerId: input.expectedOwnerId,
    replacementOwnerId: replacement.id
  };
}
