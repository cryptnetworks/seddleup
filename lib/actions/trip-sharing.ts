"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUserId } from "@/lib/actions/session";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TRIP_SHARE_EXPIRY,
  DEFAULT_TRIP_SHARE_NAME_MODE,
  generateTripShareToken,
  hashTripShareToken,
  tripShareExpiresAt,
  tripShareExpiryOptions,
  tripShareNameModes,
  tripShareStatus
} from "@/lib/trip-sharing";
import { requireTripManager } from "@/lib/trip-access";
import { publicUrl } from "@/lib/url";
import { formString, idSchema } from "@/lib/validation";

const settingsSchema = z.object({
  participantNameMode: z.enum(tripShareNameModes).default(DEFAULT_TRIP_SHARE_NAME_MODE),
  expiry: z.enum(tripShareExpiryOptions).default(DEFAULT_TRIP_SHARE_EXPIRY)
});

export type TripShareActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  shareUrl?: string;
};

function parseSettings(formData: FormData) {
  return settingsSchema.safeParse({
    participantNameMode: formString(formData, "participantNameMode"),
    expiry: formString(formData, "expiry")
  });
}

export async function createOrRotateTripShareLink(
  tripId: string,
  _previousState: TripShareActionState,
  formData: FormData
): Promise<TripShareActionState> {
  void _previousState;
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedSettings = parseSettings(formData);
  if (!parsedTripId.success || !parsedSettings.success) {
    return { status: "error", message: "Choose valid sharing settings and try again." };
  }

  const userId = await requireCurrentUserId();
  await requireTripManager(tripId, userId);

  const existing = await prisma.tripShareLink.findUnique({ where: { tripId } });
  const token = generateTripShareToken();
  const now = new Date();
  const expiresAt = tripShareExpiresAt(parsedSettings.data.expiry, now);
  const link = await prisma.tripShareLink.upsert({
    where: { tripId },
    update: {
      tokenHash: hashTripShareToken(token),
      participantNameMode: parsedSettings.data.participantNameMode,
      expiresAt,
      revokedAt: null,
      createdAt: now,
      createdByUserId: userId
    },
    create: {
      tripId,
      tokenHash: hashTripShareToken(token),
      participantNameMode: parsedSettings.data.participantNameMode,
      expiresAt,
      createdByUserId: userId
    }
  });
  const action = existing ? "trip_share.rotate" : "trip_share.create";

  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action,
    targetType: "trip_share_link",
    targetId: link.id,
    before: existing
      ? {
          status: tripShareStatus(existing, now),
          participantNameMode: existing.participantNameMode,
          expiresAt: existing.expiresAt?.toISOString() || null
        }
      : null,
    after: {
      status: "active",
      participantNameMode: link.participantNameMode,
      expiresAt: link.expiresAt?.toISOString() || null
    }
  });
  logger.info(action, { userId, tripId, tripShareLinkId: link.id });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/share`);

  return {
    status: "success",
    message: existing
      ? "A new sharing link was created. The previous link no longer works."
      : "The sharing link is ready. Save it now; SeddleUp does not store the raw link.",
    shareUrl: publicUrl(`/share/trip/${encodeURIComponent(token)}`).toString()
  };
}

export async function updateTripShareSettings(
  tripId: string,
  _previousState: TripShareActionState,
  formData: FormData
): Promise<TripShareActionState> {
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedSettings = parseSettings(formData);
  if (!parsedTripId.success || !parsedSettings.success) {
    return { status: "error", message: "Choose valid sharing settings and try again." };
  }

  const userId = await requireCurrentUserId();
  await requireTripManager(tripId, userId);
  const existing = await prisma.tripShareLink.findUnique({ where: { tripId } });
  if (!existing || tripShareStatus(existing) === "revoked") {
    return { status: "error", message: "Create a sharing link before updating its settings." };
  }

  const updated = await prisma.tripShareLink.update({
    where: { id: existing.id },
    data: {
      participantNameMode: parsedSettings.data.participantNameMode,
      expiresAt: tripShareExpiresAt(parsedSettings.data.expiry)
    }
  });
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "trip_share.settings_update",
    targetType: "trip_share_link",
    targetId: updated.id,
    before: {
      participantNameMode: existing.participantNameMode,
      expiresAt: existing.expiresAt?.toISOString() || null
    },
    after: {
      participantNameMode: updated.participantNameMode,
      expiresAt: updated.expiresAt?.toISOString() || null
    }
  });
  logger.info("trip_share.settings_update", {
    userId,
    tripId,
    tripShareLinkId: updated.id
  });
  revalidatePath(`/trips/${tripId}/share`);
  return { status: "success", message: "Sharing settings updated." };
}

export async function revokeTripShareLink(
  tripId: string,
  _previousState: TripShareActionState
): Promise<TripShareActionState> {
  void _previousState;
  const parsedTripId = idSchema.safeParse(tripId);
  if (!parsedTripId.success) return { status: "error", message: "Sharing link not found." };

  const userId = await requireCurrentUserId();
  await requireTripManager(tripId, userId);
  const existing = await prisma.tripShareLink.findUnique({ where: { tripId } });
  if (!existing || tripShareStatus(existing) === "revoked") {
    return { status: "error", message: "The sharing link is already unavailable." };
  }

  const revokedAt = new Date();
  await prisma.tripShareLink.update({
    where: { id: existing.id },
    data: { revokedAt }
  });
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "trip_share.revoke",
    targetType: "trip_share_link",
    targetId: existing.id,
    before: { status: tripShareStatus(existing, revokedAt) },
    after: { status: "revoked", revokedAt: revokedAt.toISOString() }
  });
  logger.info("trip_share.revoke", { userId, tripId, tripShareLinkId: existing.id });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/share`);
  return { status: "success", message: "The sharing link was revoked immediately." };
}
