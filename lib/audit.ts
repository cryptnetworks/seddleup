import { headers } from "next/headers";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditClient = PrismaClient | Prisma.TransactionClient;

type AuditInput = {
  actorUserId?: string | null;
  tripId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput, client: AuditClient = prisma) {
  const requestHeaders = await headers();
  const ipAddress =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    null;
  const userAgent = requestHeaders.get("user-agent");

  await client.auditLog.create({
    data: {
      actorUserId: input.actorUserId || null,
      tripId: input.tripId || null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      entityType: input.entityType || input.targetType,
      entityId: input.entityId || input.targetId || null,
      beforeJson: input.before ? JSON.stringify(input.before) : null,
      afterJson: input.after ? JSON.stringify(input.after) : null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      ipAddress,
      userAgent
    }
  });
}

export async function writeSystemAuditLog(input: Omit<AuditInput, "actorUserId">) {
  await prisma.auditLog.create({
    data: {
      actorUserId: null,
      tripId: input.tripId || null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      entityType: input.entityType || input.targetType,
      entityId: input.entityId || input.targetId || null,
      beforeJson: input.before ? JSON.stringify(input.before) : null,
      afterJson: input.after ? JSON.stringify(input.after) : null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null
    }
  });
}

const auditActionLabels: Record<string, string> = {
  "expense.create": "Added an expense",
  "expense.delete": "Deleted an expense",
  "expense.update": "Updated an expense",
  "invitation.created": "Sent an invitation",
  "invitation.resent": "Resent an invitation",
  "invitation.revoked": "Revoked an invitation",
  "participant.create": "Added a participant",
  "participant.delete": "Removed a participant",
  "participant.update": "Updated a participant",
  "receipt.review": "Reviewed a receipt",
  "receipt.upload": "Uploaded a receipt",
  "trip.create": "Created the trip",
  "trip.delete": "Deleted the trip",
  "trip.update": "Updated trip details",
  "trip_payment.confirm": "Confirmed a payment received",
  "trip_payment.delete": "Deleted a payment confirmation",
  "trip_payment.update": "Updated a payment confirmation",
  "trip_share.revoke": "Revoked a share link",
  "trip_share.settings_update": "Updated sharing settings"
};

export function auditActionLabel(action: string) {
  const knownLabel = auditActionLabels[action];
  if (knownLabel) return knownLabel;

  const words = action
    .split(/[._-]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .join(" ");
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Activity recorded";
}
