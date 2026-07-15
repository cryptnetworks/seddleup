"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUserId } from "@/lib/actions/session";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { cleanupStoredReceipts } from "@/lib/receipts/cleanup";
import { ensureOwnerMembership, requireTripManager } from "@/lib/trip-access";
import { formString, idSchema, parseDateInput, tripSchema } from "@/lib/validation";

export async function createTrip(formData: FormData) {
  const userId = await requireCurrentUserId();
  const parsed = tripSchema.safeParse({
    name: formString(formData, "name"),
    destination: formString(formData, "destination"),
    startDate: formString(formData, "startDate"),
    endDate: formString(formData, "endDate")
  });

  if (!parsed.success) {
    logger.warn("trip.create.validation_failed", { userId });
    redirect("/trips/new?error=invalid");
  }

  const trip = await prisma.trip.create({
    data: {
      name: parsed.data.name,
      destination: parsed.data.destination || null,
      startDate: parseDateInput(parsed.data.startDate),
      endDate: parseDateInput(parsed.data.endDate),
      ownerId: userId
    }
  });
  await ensureOwnerMembership(trip.id, userId);
  await writeAuditLog({
    actorUserId: userId,
    tripId: trip.id,
    action: "trip.create",
    targetType: "trip",
    targetId: trip.id,
    after: {
      name: trip.name,
      destination: trip.destination
    }
  });

  logger.info("trip.create.success", { userId, tripId: trip.id });
  revalidatePath("/dashboard");
  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(tripId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  if (!parsedTripId.success) redirect("/dashboard");

  const parsed = tripSchema.safeParse({
    name: formString(formData, "name"),
    destination: formString(formData, "destination"),
    startDate: formString(formData, "startDate"),
    endDate: formString(formData, "endDate")
  });

  if (!parsed.success) {
    logger.warn("trip.update.validation_failed", { userId, tripId });
    redirect(`/trips/${tripId}/edit?error=invalid`);
  }

  const existing = await requireTripManager(tripId, userId);

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: {
      name: parsed.data.name,
      destination: parsed.data.destination || null,
      startDate: parseDateInput(parsed.data.startDate),
      endDate: parseDateInput(parsed.data.endDate)
    }
  });
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "trip.update",
    targetType: "trip",
    targetId: tripId,
    before: {
      name: existing.trip.name,
      destination: existing.trip.destination,
      startDate: existing.trip.startDate?.toISOString() || null,
      endDate: existing.trip.endDate?.toISOString() || null
    },
    after: {
      name: updated.name,
      destination: updated.destination,
      startDate: updated.startDate?.toISOString() || null,
      endDate: updated.endDate?.toISOString() || null
    }
  });

  logger.info("trip.update.success", { userId, tripId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  if (!parsedTripId.success) redirect("/dashboard");

  await requireTripManager(tripId, userId);
  const receipts = await prisma.receipt.findMany({
    where: { tripId },
    select: { id: true, storedPath: true }
  });
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "trip.delete",
    targetType: "trip",
    targetId: tripId
  });
  await prisma.trip.delete({ where: { id: tripId } });
  await cleanupStoredReceipts(receipts, "trip.delete");
  logger.info("trip.delete.success", { userId, tripId });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
