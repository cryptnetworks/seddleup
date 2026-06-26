"use server";

import type { Participant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUserId } from "@/lib/actions/session";
import { writeAuditLog } from "@/lib/audit";
import { calculateEqualShares } from "@/lib/calculations";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireTripAccess } from "@/lib/trip-access";
import {
  canCreateTripExpense,
  canDeleteExpense,
  canEditExpense,
  coerceExpenseStatusForRole,
  isTripManager
} from "@/lib/trip-permissions";
import {
  expenseSchema,
  formString,
  idSchema,
  parseDateInput,
  type ExpenseFormData
} from "@/lib/validation";

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    title: formString(formData, "title"),
    amount: formString(formData, "amount").replace(",", "."),
    category: formString(formData, "category"),
    payerId: formString(formData, "payerId"),
    date: formString(formData, "date"),
    status: formString(formData, "status") || "submitted",
    notes: formString(formData, "notes"),
    sharedParticipantIds: formData.getAll("sharedParticipantIds").map(String)
  });
}

function selectedExpenseParticipants(
  participants: Participant[],
  sharedParticipantIds: string[],
  fallbackToAll: boolean
) {
  const selectedIds =
    fallbackToAll && sharedParticipantIds.length === 0
      ? participants.map((participant) => participant.id)
      : sharedParticipantIds;
  const selectedIdSet = new Set(selectedIds);

  return participants.filter((participant) => selectedIdSet.has(participant.id));
}

function userCanUsePayer(
  role: string,
  userId: string,
  payer: Pick<Participant, "userId"> | undefined
) {
  return isTripManager(role) || payer?.userId === userId;
}

function expenseSnapshot(expense: {
  title: string;
  amount: unknown;
  category: string;
  payerId: string;
  date: Date;
  notes: string | null;
  status: string;
}) {
  return {
    title: expense.title,
    amount: Number(expense.amount),
    category: expense.category,
    payerId: expense.payerId,
    date: expense.date.toISOString(),
    notes: expense.notes,
    status: expense.status
  };
}

function expenseShareData(amount: number, participants: Participant[]) {
  const shares = calculateEqualShares(amount, participants.length);
  return participants.map((participant, index) => ({
    participantId: participant.id,
    shareAmount: shares[index]
  }));
}

function expenseDataFromInput(
  input: ExpenseFormData,
  payer: Participant,
  selectedParticipants: Participant[],
  role: string,
  userId: string
) {
  return {
    title: input.title,
    amount: input.amount,
    category: input.category,
    payerId: input.payerId,
    paidByUserId: payer.userId || null,
    updatedByUserId: userId,
    status: coerceExpenseStatusForRole(input.status, role),
    date: parseDateInput(input.date) ?? new Date(),
    notes: input.notes || null,
    shares: {
      create: expenseShareData(input.amount, selectedParticipants)
    }
  };
}

function sharedParticipantIds(participants: Participant[]) {
  return participants.map((participant) => participant.id);
}

export async function createExpense(tripId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  if (!parsedTripId.success) redirect("/dashboard");

  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    logger.warn("expense.create.validation_failed", { userId, tripId });
    redirect(`/trips/${tripId}/expenses/new?error=invalid`);
  }

  const resolved = await requireTripAccess(tripId, userId);
  if (!canCreateTripExpense(resolved.access.role)) {
    logger.warn("expense.create.denied", { userId, tripId, role: resolved.access.role });
    redirect(`/trips/${tripId}?error=forbidden`);
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: { participants: true }
  });
  if (!trip) redirect("/dashboard");

  const selectedParticipants = selectedExpenseParticipants(
    trip.participants,
    parsed.data.sharedParticipantIds,
    true
  );

  const payer = trip.participants.find((participant) => participant.id === parsed.data.payerId);
  if (!payer || selectedParticipants.length === 0) {
    logger.warn("expense.create.participants_invalid", { userId, tripId });
    redirect(`/trips/${tripId}/expenses/new?error=participants`);
  }

  if (!userCanUsePayer(resolved.access.role, userId, payer)) {
    logger.warn("expense.create.payer_denied", { userId, tripId, payerId: payer.id });
    redirect(`/trips/${tripId}/expenses/new?error=payer`);
  }

  const expense = await prisma.expense.create({
    data: {
      ...expenseDataFromInput(
        parsed.data,
        payer,
        selectedParticipants,
        resolved.access.role,
        userId
      ),
      tripId,
      createdByUserId: userId
    }
  });
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "expense.create",
    targetType: "expense",
    targetId: expense.id,
    after: expenseSnapshot(expense),
    metadata: { shareParticipantIds: sharedParticipantIds(selectedParticipants) }
  });

  logger.info("expense.create.success", { userId, tripId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function updateExpense(tripId: string, expenseId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedExpenseId = idSchema.safeParse(expenseId);
  if (!parsedTripId.success || !parsedExpenseId.success) redirect("/dashboard");

  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    logger.warn("expense.update.validation_failed", { userId, tripId, expenseId });
    redirect(`/trips/${tripId}/expenses/${expenseId}/edit?error=invalid`);
  }

  const resolved = await requireTripAccess(tripId, userId);
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: { participants: true }
  });
  if (!trip) redirect("/dashboard");

  const selectedParticipants = selectedExpenseParticipants(
    trip.participants,
    parsed.data.sharedParticipantIds,
    false
  );

  const payer = trip.participants.find((participant) => participant.id === parsed.data.payerId);
  if (!payer || selectedParticipants.length === 0) {
    logger.warn("expense.update.participants_invalid", { userId, tripId, expenseId });
    redirect(`/trips/${tripId}/expenses/${expenseId}/edit?error=participants`);
  }

  const existingExpense = await prisma.expense.findFirst({
    where: { id: expenseId, tripId }
  });
  if (!existingExpense) redirect(`/trips/${tripId}`);
  if (!canEditExpense(resolved.access.role, userId, existingExpense)) {
    logger.warn("expense.update.denied", { userId, tripId, expenseId });
    redirect(`/trips/${tripId}?error=forbidden`);
  }
  if (!userCanUsePayer(resolved.access.role, userId, payer)) {
    logger.warn("expense.update.payer_denied", { userId, tripId, expenseId, payerId: payer.id });
    redirect(`/trips/${tripId}/expenses/${expenseId}/edit?error=payer`);
  }

  const [, updatedExpense] = await prisma.$transaction([
    prisma.expenseShare.deleteMany({ where: { expenseId } }),
    prisma.expense.update({
      where: { id: expenseId },
      data: expenseDataFromInput(
        parsed.data,
        payer,
        selectedParticipants,
        resolved.access.role,
        userId
      )
    })
  ]);
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "expense.update",
    targetType: "expense",
    targetId: expenseId,
    before: expenseSnapshot(existingExpense),
    after: expenseSnapshot(updatedExpense),
    metadata: { shareParticipantIds: sharedParticipantIds(selectedParticipants) }
  });

  logger.info("expense.update.success", { userId, tripId, expenseId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function deleteExpense(tripId: string, expenseId: string) {
  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedExpenseId = idSchema.safeParse(expenseId);
  if (!parsedTripId.success || !parsedExpenseId.success) redirect("/dashboard");

  const resolved = await requireTripAccess(tripId, userId);
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, tripId } });
  if (!expense) redirect(`/trips/${tripId}`);
  if (!canDeleteExpense(resolved.access.role, userId, expense)) {
    logger.warn("expense.delete.denied", { userId, tripId, expenseId });
    redirect(`/trips/${tripId}?error=forbidden`);
  }
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "expense.delete",
    targetType: "expense",
    targetId: expenseId,
    before: expenseSnapshot(expense)
  });
  await prisma.expense.delete({ where: { id: expenseId } });
  logger.info("expense.delete.success", { userId, tripId, expenseId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
