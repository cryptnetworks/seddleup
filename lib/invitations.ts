import crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { Prisma, type Invitation, type PrismaClient, type User } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";
import { digestLookupToken, timingSafeEqualTokenDigest } from "@/lib/token-digest";
import { getAuthSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/url";

export const invitationStatuses = ["pending", "accepted", "expired", "revoked"] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

export const INVITATION_EXPIRATION_DAYS = 7;

type InvitationClient = PrismaClient | Prisma.TransactionClient;

type CreateInvitationInput = {
  email: string;
  invitedByUserId: string;
  displayName?: string | null;
  role?: string | null;
  tripId?: string | null;
};

type InvitationWithRawToken = Invitation & { rawToken: string };

type InvitationWithContext = Prisma.InvitationGetPayload<{
  include: {
    trip: { select: { id: true; name: true } };
    invitedBy: { select: { username: true; email: true } };
  };
}>;

type InternalInvitationCreateResult =
  | { ok: true; invitation: InvitationWithRawToken }
  | { ok: false; reason: "existing-user" | "duplicate-pending" | "invalid-role" };

export type InvitationCreateResult =
  | { ok: true; invitation: Invitation }
  | { ok: false; reason: "existing-user" | "duplicate-pending" | "invalid-role" };

export type InvitationAcceptResult =
  | { ok: true; userId: string; tripId: string | null }
  | {
      ok: false;
      reason:
        | "invalid"
        | "expired"
        | "revoked"
        | "accepted"
        | "email-mismatch"
        | "existing-user"
        | "duplicate-user"
        | "invalid-form";
    };

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateInvitationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return digestLookupToken(token);
}

export function invitationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
}

export function buildInvitationUrl(token: string) {
  return publicUrl(`/invite/accept?token=${encodeURIComponent(token)}`).toString();
}

function normalizeInviteRole(role?: string | null) {
  if (!role) return null;
  return role === "readonly" || role === "user" ? role : "invalid";
}

function isExpired(invitation: Pick<Invitation, "expiresAt">, now = new Date()) {
  return invitation.expiresAt.getTime() <= now.getTime();
}

function isUsablePendingInvite(
  invitation: Pick<Invitation, "status" | "expiresAt">,
  now = new Date()
) {
  return invitation.status === "pending" && !isExpired(invitation, now);
}

async function markExpired<T extends Invitation>(invitation: T, client: InvitationClient = prisma) {
  if (invitation.status !== "pending" || !isExpired(invitation)) return invitation;
  await client.invitation.update({
    where: { id: invitation.id },
    data: { status: "expired" }
  });
  return { ...invitation, status: "expired" } as T;
}

async function sendInviteForRecord(invitation: InvitationWithRawToken) {
  const inviteDetails = await prisma.invitation.findUniqueOrThrow({
    where: { id: invitation.id },
    include: {
      invitedBy: { select: { username: true, email: true } },
      trip: { select: { name: true } }
    }
  });

  await sendInvitationEmail({
    to: inviteDetails.email,
    inviteUrl: buildInvitationUrl(invitation.rawToken),
    expiresInDays: INVITATION_EXPIRATION_DAYS,
    inviterName: inviteDetails.invitedBy.username,
    inviterEmail: inviteDetails.invitedBy.email,
    tripName: inviteDetails.trip?.name
  });
}

async function createInvitationRecord(
  input: CreateInvitationInput,
  client: InvitationClient = prisma
): Promise<InternalInvitationCreateResult> {
  const email = normalizeInviteEmail(input.email);
  const role = normalizeInviteRole(input.role);
  if (role === "invalid") return { ok: false, reason: "invalid-role" };

  const existingUser = await client.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) return { ok: false, reason: "existing-user" };

  const pendingInvite = await client.invitation.findFirst({
    where: {
      email,
      tripId: input.tripId || null,
      status: "pending",
      expiresAt: { gt: new Date() }
    }
  });
  if (pendingInvite) return { ok: false, reason: "duplicate-pending" };

  const token = generateInvitationToken();
  try {
    const invitation = await client.invitation.create({
      data: {
        email,
        displayName: input.displayName || null,
        role: role || null,
        tokenHash: hashInvitationToken(token),
        expiresAt: invitationExpiresAt(),
        invitedByUserId: input.invitedByUserId,
        tripId: input.tripId || null
      }
    });

    return { ok: true, invitation: { ...invitation, rawToken: token } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "duplicate-pending" };
    }
    throw error;
  }
}

export async function createAndSendInvitation(
  input: CreateInvitationInput
): Promise<InvitationCreateResult> {
  const inviteCreation = await createInvitationRecord(input);
  if (!inviteCreation.ok) return inviteCreation;
  await sendInviteForRecord(inviteCreation.invitation);
  logger.info("invitation.created", {
    invitationId: inviteCreation.invitation.id,
    tripId: inviteCreation.invitation.tripId
  });
  return { ok: true, invitation: inviteCreation.invitation };
}

export async function createAndSendTripInvitation(
  input: CreateInvitationInput
): Promise<InvitationCreateResult> {
  return createAndSendInvitation({ ...input, role: null });
}

export async function resendInvitation(invitationId: string, actorUserId: string) {
  const token = generateInvitationToken();
  const now = new Date();
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) return false;
  if (invitation.status === "pending" && isExpired(invitation, now)) {
    await markExpired(invitation);
    return false;
  }
  if (!isUsablePendingInvite(invitation, now)) return false;

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      tokenHash: hashInvitationToken(token),
      expiresAt: invitationExpiresAt(now)
    }
  });
  await sendInviteForRecord({ ...updated, rawToken: token });
  logger.info("invitation.resent", { invitationId, actorUserId });
  return true;
}

export async function revokeInvitation(invitationId: string, actorUserId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) return false;
  if (invitation.status === "pending" && isExpired(invitation)) {
    await markExpired(invitation);
    return false;
  }
  if (!isUsablePendingInvite(invitation)) return false;

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      status: "revoked",
      revokedAt: new Date()
    }
  });
  logger.info("invitation.revoked", { invitationId, actorUserId });
  return true;
}

export async function findInvitationByToken(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) }
  });
  if (!invitation || !timingSafeEqualTokenDigest(token, invitation.tokenHash)) return null;
  return markExpired(invitation);
}

export async function getInvitationContextByToken(
  token: string
): Promise<InvitationWithContext | null> {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      trip: { select: { id: true, name: true } },
      invitedBy: { select: { username: true, email: true } }
    }
  });
  if (!invitation || !timingSafeEqualTokenDigest(token, invitation.tokenHash)) return null;
  return markExpired(invitation);
}

function inviteStatusReason(invitation: Invitation | null): InvitationAcceptResult | null {
  if (!invitation) return { ok: false, reason: "invalid" };
  if (invitation.status === "expired") return { ok: false, reason: "expired" };
  if (invitation.status === "revoked") return { ok: false, reason: "revoked" };
  if (invitation.status === "accepted") return { ok: false, reason: "accepted" };
  if (invitation.status !== "pending") return { ok: false, reason: "invalid" };
  if (isExpired(invitation)) return { ok: false, reason: "expired" };
  return null;
}

async function completeInvitationAcceptance(
  client: InvitationClient,
  invitation: Pick<Invitation, "id" | "email" | "tripId">,
  userId: string,
  now: Date
) {
  const accepted = await client.invitation.updateMany({
    where: {
      id: invitation.id,
      status: "pending",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now }
    },
    data: {
      status: "accepted",
      acceptedAt: now,
      acceptedByUserId: userId
    }
  });
  if (accepted.count !== 1) {
    throw new Error("Invitation is no longer pending.");
  }

  if (invitation.tripId) {
    await client.tripMember.upsert({
      where: { tripId_userId: { tripId: invitation.tripId, userId } },
      update: {},
      create: { tripId: invitation.tripId, userId, role: "member" }
    });
    await client.participant.updateMany({
      where: { tripId: invitation.tripId, email: invitation.email, userId: null },
      data: { userId }
    });
  }
}

export async function acceptInvitationForExistingUser(
  token: string,
  user: Pick<User, "id" | "email">
) {
  const invitation = await findInvitationByToken(token);
  const invalid = inviteStatusReason(invitation);
  if (invalid) return invalid;
  if (!invitation) return { ok: false, reason: "invalid" } as const;
  if (normalizeInviteEmail(user.email) !== invitation.email) {
    return { ok: false, reason: "email-mismatch" } as const;
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: now }
      });
      await completeInvitationAcceptance(tx, invitation, user.id, now);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invitation is no longer pending.") {
      return { ok: false, reason: "accepted" } as const;
    }
    throw error;
  }

  logger.info("invitation.accepted_existing_user", {
    invitationId: invitation.id,
    userId: user.id
  });
  return { ok: true, userId: user.id, tripId: invitation.tripId } as const;
}

export async function acceptInvitationWithNewUser(input: {
  token: string;
  username: string;
  password: string;
  confirmPassword: string;
}) {
  const invitation = await findInvitationByToken(input.token);
  const invalid = inviteStatusReason(invitation);
  if (invalid) return invalid;
  if (!invitation) return { ok: false, reason: "invalid" } as const;

  const username = input.username.trim();
  if (
    username.length < 3 ||
    username.length > 80 ||
    input.password.length < 8 ||
    input.password.length > 128 ||
    input.password !== input.confirmPassword
  ) {
    return { ok: false, reason: "invalid-form" } as const;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) return { ok: false, reason: "existing-user" } as const;

  const duplicateUsername = await prisma.user.findUnique({ where: { username } });
  if (duplicateUsername) return { ok: false, reason: "duplicate-user" } as const;

  const settings = await getAuthSettings();
  const role =
    invitation.role === "readonly" || invitation.role === "user"
      ? invitation.role
      : settings.defaultUserRole;
  const now = new Date();

  let user: User;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          email: invitation.email,
          role,
          emailVerifiedAt: now,
          passwordHash: await bcrypt.hash(input.password, 12)
        }
      });
      await completeInvitationAcceptance(tx, invitation, created.id, now);
      return created;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invitation is no longer pending.") {
      return { ok: false, reason: "accepted" } as const;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "duplicate-user" } as const;
    }
    throw error;
  }

  logger.info("invitation.accepted_new_user", { invitationId: invitation.id, userId: user.id });
  return { ok: true, userId: user.id, tripId: invitation.tripId } as const;
}
