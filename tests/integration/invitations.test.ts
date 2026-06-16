import * as bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitationForExistingUser,
  acceptInvitationWithNewUser,
  createAndSendInvitation,
  hashInvitationToken,
  invitationExpiresAt
} from "@/lib/invitations";

const testRun = Date.now();
const createdUserIds: string[] = [];
const createdTripIds: string[] = [];
const createdInvitationIds: string[] = [];

async function createUser(label: string, role = "user") {
  const user = await prisma.user.create({
    data: {
      username: `invite-${label}-${testRun}`,
      email: `invite-${label}-${testRun}@seddleup.test`,
      role,
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash("TestPass123", 12)
    }
  });
  createdUserIds.push(user.id);
  return user;
}

async function createInvitation(input: {
  email: string;
  invitedByUserId: string;
  token: string;
  status?: string;
  expiresAt?: Date;
  tripId?: string;
}) {
  const invitation = await prisma.invitation.create({
    data: {
      email: input.email,
      tokenHash: hashInvitationToken(input.token),
      status: input.status || "pending",
      expiresAt: input.expiresAt || invitationExpiresAt(),
      invitedByUserId: input.invitedByUserId,
      tripId: input.tripId
    }
  });
  createdInvitationIds.push(invitation.id);
  return invitation;
}

beforeAll(() => {
  process.env.SMTP_ENABLED = "false";
});

afterAll(async () => {
  await prisma.invitation.deleteMany({ where: { id: { in: createdInvitationIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: createdTripIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("invitations integration", () => {
  it("creates an admin invitation and prevents duplicate pending invites", async () => {
    const admin = await createUser("admin-create", "admin");
    const email = `pending-${testRun}@seddleup.test`;

    const first = await createAndSendInvitation({
      email,
      displayName: "Pending User",
      role: "readonly",
      invitedByUserId: admin.id
    });

    expect(first.ok).toBe(true);
    if (first.ok) createdInvitationIds.push(first.invitation.id);
    if (!first.ok) throw new Error("expected invitation creation to succeed");
    expect(first.invitation.email).toBe(email);
    expect(first.invitation.role).toBe("readonly");
    expect(first.invitation.tokenHash).toHaveLength(64);

    const duplicate = await createAndSendInvitation({
      email,
      invitedByUserId: admin.id
    });

    expect(duplicate).toEqual({ ok: false, reason: "duplicate-pending" });
  });

  it("does not create an invitation for an existing user", async () => {
    const admin = await createUser("admin-existing", "admin");
    const existing = await createUser("existing");

    await expect(
      createAndSendInvitation({
        email: existing.email,
        invitedByUserId: admin.id
      })
    ).resolves.toEqual({ ok: false, reason: "existing-user" });
  });

  it("accepts a valid invite by creating a verified user", async () => {
    const admin = await createUser("admin-new", "admin");
    const token = `new-user-token-${testRun}`;
    const email = `new-user-${testRun}@seddleup.test`;
    await createInvitation({ email, invitedByUserId: admin.id, token });

    const result = await acceptInvitationWithNewUser({
      token,
      username: `new-invite-${testRun}`,
      password: "TestPass123",
      confirmPassword: "TestPass123"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected invite acceptance to succeed");
    createdUserIds.push(result.userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    const invitation = await prisma.invitation.findFirstOrThrow({ where: { email } });
    expect(user.email).toBe(email);
    expect(user.emailVerifiedAt).toBeTruthy();
    expect(invitation.status).toBe("accepted");
    expect(invitation.acceptedByUserId).toBe(user.id);
  });

  it("accepts a trip invite and adds the user to the trip", async () => {
    const admin = await createUser("admin-trip", "admin");
    const owner = await createUser("owner-trip");
    const existing = await createUser("existing-trip");
    const trip = await prisma.trip.create({
      data: {
        name: "Invite Trip",
        ownerId: owner.id,
        participants: {
          create: { name: "Existing Trip User", email: existing.email }
        }
      },
      include: { participants: true }
    });
    createdTripIds.push(trip.id);
    const token = `trip-token-${testRun}`;
    await createInvitation({
      email: existing.email,
      invitedByUserId: admin.id,
      token,
      tripId: trip.id
    });

    const result = await acceptInvitationForExistingUser(token, existing);

    expect(result).toEqual({ ok: true, userId: existing.id, tripId: trip.id });
    await expect(
      prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: trip.id, userId: existing.id } }
      })
    ).resolves.toMatchObject({ role: "member" });
    await expect(
      prisma.participant.findFirst({
        where: { tripId: trip.id, email: existing.email }
      })
    ).resolves.toMatchObject({ userId: existing.id });
  });

  it("rejects expired, invalid, revoked, accepted, and mismatched invites", async () => {
    const admin = await createUser("admin-invalid", "admin");
    const user = await createUser("invalid-user");
    await createInvitation({
      email: user.email,
      invitedByUserId: admin.id,
      token: `expired-token-${testRun}`,
      expiresAt: new Date(Date.now() - 1000)
    });
    await createInvitation({
      email: user.email,
      invitedByUserId: admin.id,
      token: `revoked-token-${testRun}`,
      status: "revoked"
    });
    await createInvitation({
      email: user.email,
      invitedByUserId: admin.id,
      token: `accepted-token-${testRun}`,
      status: "accepted"
    });

    await expect(acceptInvitationForExistingUser("missing-token", user)).resolves.toEqual({
      ok: false,
      reason: "invalid"
    });
    await expect(
      acceptInvitationForExistingUser(`expired-token-${testRun}`, user)
    ).resolves.toEqual({
      ok: false,
      reason: "expired"
    });
    await expect(
      acceptInvitationForExistingUser(`revoked-token-${testRun}`, user)
    ).resolves.toEqual({
      ok: false,
      reason: "revoked"
    });
    await expect(
      acceptInvitationForExistingUser(`accepted-token-${testRun}`, user)
    ).resolves.toEqual({
      ok: false,
      reason: "accepted"
    });

    const mismatchToken = `mismatch-token-${testRun}`;
    await createInvitation({
      email: `different-${testRun}@seddleup.test`,
      invitedByUserId: admin.id,
      token: mismatchToken
    });
    await expect(acceptInvitationForExistingUser(mismatchToken, user)).resolves.toEqual({
      ok: false,
      reason: "email-mismatch"
    });
  });
});
