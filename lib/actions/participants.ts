"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUserId } from "@/lib/actions/session";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
  hasParticipantFinancialDependencies,
  participantFinancialDependencies
} from "@/lib/participant-integrity";
import { prisma } from "@/lib/prisma";
import { requireTripManager } from "@/lib/trip-access";
import { formString, idSchema, participantSchema } from "@/lib/validation";
import { createAndSendTripInvitation } from "@/lib/invitations";

async function findUserForParticipantEmail(email?: string) {
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
}

async function ensureParticipantMembership(tripId: string, userId?: string | null) {
  if (!userId) return;
  await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId, userId } },
    update: {},
    create: { tripId, userId, role: "member" }
  });
}

async function ensureTripInvitationForUnknownUser(input: {
  tripId: string;
  actorUserId: string;
  email?: string;
  displayName?: string;
}) {
  if (!input.email) return null;
  const tripInvite = await createAndSendTripInvitation({
    email: input.email,
    displayName: input.displayName,
    tripId: input.tripId,
    invitedByUserId: input.actorUserId
  });
  if (
    !tripInvite.ok &&
    tripInvite.reason !== "duplicate-pending" &&
    tripInvite.reason !== "existing-user"
  ) {
    logger.warn("participant.invitation.skipped", {
      tripId: input.tripId,
      reason: tripInvite.reason
    });
  }
  return tripInvite;
}

export async function createParticipant(tripId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  if (!parsedTripId.success) redirect("/dashboard");

  const parsed = participantSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email")
  });

  if (!parsed.success) {
    logger.warn("participant.create.validation_failed", { userId, tripId });
    redirect(`/trips/${tripId}?error=participant`);
  }

  await requireTripManager(tripId, userId);
  const linkedUser = await findUserForParticipantEmail(parsed.data.email);

  const participant = await prisma.participant.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      tripId,
      userId: linkedUser?.id || null
    }
  });
  await ensureParticipantMembership(tripId, linkedUser?.id);
  if (!linkedUser) {
    await ensureTripInvitationForUnknownUser({
      tripId,
      actorUserId: userId,
      email: parsed.data.email,
      displayName: parsed.data.name
    });
  }
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "participant.create",
    targetType: "participant",
    targetId: participant.id,
    after: {
      name: participant.name,
      email: participant.email,
      userId: participant.userId
    }
  });

  logger.info("participant.create.success", { userId, tripId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function updateParticipant(tripId: string, participantId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedParticipantId = idSchema.safeParse(participantId);
  if (!parsedTripId.success || !parsedParticipantId.success) redirect("/dashboard");

  const parsed = participantSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email")
  });

  if (!parsed.success) {
    logger.warn("participant.update.validation_failed", { userId, tripId, participantId });
    redirect(`/trips/${tripId}/participants/${participantId}/edit?error=invalid`);
  }

  await requireTripManager(tripId, userId);
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, tripId }
  });
  if (!participant) redirect(`/trips/${tripId}`);
  const linkedUser = await findUserForParticipantEmail(parsed.data.email);

  const updated = await prisma.participant.update({
    where: { id: participantId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      userId: linkedUser?.id || null
    }
  });
  await ensureParticipantMembership(tripId, linkedUser?.id);
  if (!linkedUser) {
    await ensureTripInvitationForUnknownUser({
      tripId,
      actorUserId: userId,
      email: parsed.data.email,
      displayName: parsed.data.name
    });
  }
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "participant.update",
    targetType: "participant",
    targetId: participant.id,
    before: {
      name: participant.name,
      email: participant.email,
      userId: participant.userId
    },
    after: {
      name: updated.name,
      email: updated.email,
      userId: updated.userId
    }
  });

  logger.info("participant.update.success", { userId, tripId, participantId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function deleteParticipant(tripId: string, participantId: string) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedParticipantId = idSchema.safeParse(participantId);
  if (!parsedTripId.success || !parsedParticipantId.success) redirect("/dashboard");

  await requireTripManager(tripId, userId);
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const participant = await tx.participant.findFirst({ where: { id: participantId, tripId } });
      if (!participant) return { status: "missing" as const };

      const dependencies = await participantFinancialDependencies(tx, participantId);
      if (hasParticipantFinancialDependencies(dependencies)) {
        return { status: "blocked" as const, dependencies };
      }

      await tx.participant.delete({ where: { id: participantId } });
      return { status: "deleted" as const, participant };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      logger.warn("participant.delete.blocked_database_constraint", {
        userId,
        tripId,
        participantId
      });
      redirect(`/trips/${tripId}/participants/${participantId}/edit?error=financial-history`);
    }
    throw error;
  }

  if (result.status === "missing") redirect(`/trips/${tripId}`);
  if (result.status === "blocked") {
    logger.warn("participant.delete.blocked_financial_history", {
      userId,
      tripId,
      participantId,
      ...result.dependencies
    });
    redirect(`/trips/${tripId}/participants/${participantId}/edit?error=financial-history`);
  }

  const participant = result.participant;
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "participant.delete",
    targetType: "participant",
    targetId: participantId,
    before: {
      name: participant.name,
      email: participant.email,
      userId: participant.userId
    }
  });
  logger.info("participant.delete.success", { userId, tripId, participantId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
