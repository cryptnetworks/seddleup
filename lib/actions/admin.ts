"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { writeAuditLog } from "@/lib/audit";
import { countActiveAdmins, requireAdminAction } from "@/lib/authorization";
import { encryptProviderSecret, oauthProviderDefinitions } from "@/lib/oauth-providers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanupStoredReceipts } from "@/lib/receipts/cleanup";
import { setAuthSettings } from "@/lib/settings";
import { OwnershipTransferError, transferTripOwnershipInTransaction } from "@/lib/user-integrity";
import { adminInvitationSchema, formString, idSchema } from "@/lib/validation";
import { createAndSendInvitation, resendInvitation, revokeInvitation } from "@/lib/invitations";

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function updateUserRole(formData: FormData) {
  const actor = await requireAdminAction();
  const userId = formString(formData, "userId");
  const role = formString(formData, "role");

  if (!["admin", "user", "readonly"].includes(role)) {
    redirect("/admin/users?error=invalid-role");
  }

  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.id === actor.id && target.role === "admin" && role !== "admin") {
    redirect("/admin/users?error=self-lockout");
  }
  if (target.role === "admin" && role !== "admin" && (await countActiveAdmins(target.id)) === 0) {
    redirect("/admin/users?error=final-admin");
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.role_changed",
    targetType: "user",
    targetId: userId,
    metadata: { from: target.role, to: role }
  });
  revalidatePath("/admin/users");
}

export async function setUserDisabled(formData: FormData) {
  const actor = await requireAdminAction();
  const userId = formString(formData, "userId");
  const disabled = formString(formData, "disabled") === "true";
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (target.id === actor.id && disabled) {
    redirect("/admin/users?error=self-lockout");
  }
  if (target.role === "admin" && disabled && (await countActiveAdmins(target.id)) === 0) {
    redirect("/admin/users?error=final-admin");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { disabledAt: disabled ? new Date() : null }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: disabled ? "user.disabled" : "user.enabled",
    targetType: "user",
    targetId: userId
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const actor = await requireAdminAction();
  const userId = formString(formData, "userId");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (target.id === actor.id) {
    redirect("/admin/users?error=self-lockout");
  }
  let deletion;
  try {
    deletion = await prisma.$transaction(async (tx) => {
      if (target.role === "admin") {
        const remainingActiveAdmins = await tx.user.count({
          where: {
            id: { not: target.id },
            role: { in: ["owner", "admin"] },
            disabledAt: null
          }
        });
        if (remainingActiveAdmins === 0) return { status: "final-admin" as const };
      }

      const ownedTripCount = await tx.trip.count({ where: { ownerId: userId } });
      if (ownedTripCount > 0) {
        return { status: "owned-trips" as const, ownedTripCount };
      }

      const receipts = await tx.receipt.findMany({
        where: { uploaderUserId: userId },
        select: { id: true, storedPath: true }
      });
      await tx.user.delete({ where: { id: userId } });
      return { status: "deleted" as const, receipts };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      redirect("/admin/users?error=account-dependencies");
    }
    throw error;
  }

  if (deletion.status === "final-admin") redirect("/admin/users?error=final-admin");
  if (deletion.status === "owned-trips") {
    redirect(`/admin/users?error=owned-trips&count=${deletion.ownedTripCount}`);
  }

  const receipts = deletion.receipts;
  await cleanupStoredReceipts(receipts, "user.delete");
  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.deleted",
    targetType: "user",
    targetId: userId
  });
  revalidatePath("/admin/users");
}

export async function transferTripOwnership(formData: FormData) {
  const actor = await requireAdminAction();
  const parsedTripId = idSchema.safeParse(formString(formData, "tripId"));
  const parsedReplacementId = idSchema.safeParse(formString(formData, "replacementOwnerId"));
  if (!parsedTripId.success || !parsedReplacementId.success) {
    redirect("/admin/users?transfer=invalid");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const transfer = await transferTripOwnershipInTransaction(tx, {
        tripId: parsedTripId.data,
        replacementOwnerId: parsedReplacementId.data
      });
      await writeAuditLog(
        {
          actorUserId: actor.id,
          tripId: transfer.tripId,
          action: "trip.ownership_transferred",
          targetType: "trip",
          targetId: transfer.tripId,
          metadata: {
            previousOwnerUserId: transfer.previousOwnerId,
            replacementOwnerUserId: transfer.replacementOwnerId
          }
        },
        tx
      );
    });
  } catch (error) {
    if (error instanceof OwnershipTransferError) {
      redirect(`/admin/users?transfer=${error.reason}`);
    }
    throw error;
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?transfer=success");
}

export async function resetUserPassword(formData: FormData) {
  const actor = await requireAdminAction();
  const userId = formString(formData, "userId");
  const password = formString(formData, "password");

  if (password.length < 8 || password.length > 128) {
    redirect("/admin/users?error=password");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 12) }
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.password_reset_by_admin",
    targetType: "user",
    targetId: userId
  });
  revalidatePath("/admin/users");
}

export async function inviteUser(formData: FormData) {
  const actor = await requireAdminAction();
  const parsed = adminInvitationSchema.safeParse({
    email: formString(formData, "email"),
    displayName: formString(formData, "displayName"),
    role: formString(formData, "role") || "user"
  });

  if (!parsed.success) {
    redirect("/admin/users?invite=invalid");
  }

  const rateLimit = checkRateLimit(`admin-invite:${actor.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    redirect("/admin/users?invite=rate-limit");
  }

  const inviteCreation = await createAndSendInvitation({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    role: parsed.data.role,
    invitedByUserId: actor.id
  });

  if (!inviteCreation.ok) {
    redirect(`/admin/users?invite=${inviteCreation.reason}`);
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: "invitation.created",
    targetType: "invitation",
    targetId: inviteCreation.invitation.id,
    metadata: {
      email: parsed.data.email,
      role: parsed.data.role
    }
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?invite=sent");
}

export async function resendUserInvitation(formData: FormData) {
  const actor = await requireAdminAction();
  const invitationId = formString(formData, "invitationId");
  const rateLimit = checkRateLimit(`admin-invite-resend:${actor.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    redirect("/admin/users?invite=rate-limit");
  }

  const sent = await resendInvitation(invitationId, actor.id);
  if (!sent) redirect("/admin/users?invite=resend-blocked");

  await writeAuditLog({
    actorUserId: actor.id,
    action: "invitation.resent",
    targetType: "invitation",
    targetId: invitationId
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?invite=resent");
}

export async function revokeUserInvitation(formData: FormData) {
  const actor = await requireAdminAction();
  const invitationId = formString(formData, "invitationId");
  const revoked = await revokeInvitation(invitationId, actor.id);
  if (!revoked) redirect("/admin/users?invite=revoke-blocked");

  await writeAuditLog({
    actorUserId: actor.id,
    action: "invitation.revoked",
    targetType: "invitation",
    targetId: invitationId
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?invite=revoked");
}

export async function updateAuthProviderConfig(formData: FormData) {
  const actor = await requireAdminAction();
  const providerId = formString(formData, "providerId");
  const provider = oauthProviderDefinitions.find((item) => item.id === providerId);
  if (!provider) redirect("/admin/auth?error=provider");

  const clientSecret = formString(formData, "clientSecret");
  const clearSecret = checked(formData, "clearSecret");
  const scopes = formString(formData, "scopes")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  await prisma.authProviderConfig.upsert({
    where: { id: provider.id },
    create: {
      id: provider.id,
      name: provider.name,
      enabled: checked(formData, "enabled"),
      clientId: formString(formData, "clientId") || null,
      encryptedClientSecret: clientSecret ? encryptProviderSecret(clientSecret) : null,
      scopesJson: JSON.stringify(scopes.length ? scopes : provider.defaultScopes)
    },
    update: {
      enabled: checked(formData, "enabled"),
      clientId: formString(formData, "clientId") || null,
      encryptedClientSecret: clearSecret
        ? null
        : clientSecret
          ? encryptProviderSecret(clientSecret)
          : undefined,
      scopesJson: JSON.stringify(scopes.length ? scopes : provider.defaultScopes)
    }
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "auth.provider_config_changed",
    targetType: "auth_provider",
    targetId: provider.id,
    metadata: {
      enabled: checked(formData, "enabled"),
      secretChanged: Boolean(clientSecret),
      clearSecret
    }
  });
  revalidatePath("/admin/auth");
}

export async function updateLocalAuthSettings(formData: FormData) {
  const actor = await requireAdminAction();
  const localAuthEnabled = checked(formData, "localAuthEnabled");
  const enabledProviders = await prisma.authProviderConfig.count({
    where: { enabled: true, clientId: { not: null }, encryptedClientSecret: { not: null } }
  });

  if (!localAuthEnabled && enabledProviders === 0) {
    redirect("/admin/settings?error=lockout");
  }

  await setAuthSettings({
    localAuthEnabled,
    publicRegistrationEnabled: checked(formData, "publicRegistrationEnabled"),
    requireEmailVerification: checked(formData, "requireEmailVerification"),
    allowedEmailDomains: formString(formData, "allowedEmailDomains")
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
    defaultUserRole: formString(formData, "defaultUserRole") === "readonly" ? "readonly" : "user"
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "auth.settings_changed",
    targetType: "app_settings"
  });
  revalidatePath("/admin/settings");
}
