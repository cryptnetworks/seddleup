"use server";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUserId } from "@/lib/actions/session";
import { writeAuditLog } from "@/lib/audit";
import { getAppConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { cleanupStoredReceipts, withStoredReceiptCompensation } from "@/lib/receipts/cleanup";
import { defaultReceiptParser } from "@/lib/receipts/parser";
import {
  safeOriginalFilename,
  storeReceiptFile,
  validateReceiptFile
} from "@/lib/receipts/storage";
import { requireTripAccess } from "@/lib/trip-access";
import { canCreateTripExpense, canEditExpense, isTripManager } from "@/lib/trip-permissions";
import {
  formString,
  idSchema,
  optionalUsdMoneySchema,
  parseDateInput,
  receiptLineItemSchema,
  receiptReviewSchema
} from "@/lib/validation";

function parsedReceiptDecimal(value: number | undefined) {
  if (value === undefined) return null;
  return new Prisma.Decimal(optionalUsdMoneySchema.parse(String(value))?.decimal ?? "0.00");
}

async function requireEditableReceipt(tripId: string, receiptId: string, userId: string) {
  const resolved = await requireTripAccess(tripId, userId);
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, tripId },
    select: { id: true, uploaderUserId: true }
  });
  if (!receipt) redirect(`/trips/${tripId}`);
  if (receipt.uploaderUserId !== userId && !isTripManager(resolved.access.role)) {
    redirect(`/trips/${tripId}?error=forbidden`);
  }
  return receipt;
}

async function parsedLineItemForm(tripId: string, receiptId: string, formData: FormData) {
  const parsed = receiptLineItemSchema.safeParse({
    name: formString(formData, "name"),
    quantity: formString(formData, "quantity"),
    unitPrice: formString(formData, "unitPrice"),
    totalPrice: formString(formData, "totalPrice"),
    participantIds: formData
      .getAll("participantIds")
      .filter((value): value is string => typeof value === "string")
  });
  if (!parsed.success) {
    redirect(`/trips/${tripId}/receipts/${receiptId}?itemError=invalid`);
  }
  const uniqueParticipantIds = [...new Set(parsed.data.participantIds)];
  const participantCount = await prisma.participant.count({
    where: { tripId, id: { in: uniqueParticipantIds } }
  });
  if (participantCount !== uniqueParticipantIds.length) {
    redirect(`/trips/${tripId}/receipts/${receiptId}?itemError=participants`);
  }
  return { ...parsed.data, participantIds: uniqueParticipantIds };
}

function lineItemData(parsed: Awaited<ReturnType<typeof parsedLineItemForm>>) {
  return {
    name: parsed.name,
    quantity: new Prisma.Decimal(parsed.quantity),
    unitPrice: parsed.unitPrice ? new Prisma.Decimal(parsed.unitPrice.decimal) : null,
    totalPrice: new Prisma.Decimal(parsed.totalPrice.decimal)
  };
}

export async function createReceiptLineItem(tripId: string, receiptId: string, formData: FormData) {
  if (!getAppConfig().receiptUploadEnabled) redirect(`/trips/${tripId}?error=receipts_disabled`);
  const userId = await requireCurrentUserId();
  await requireEditableReceipt(tripId, receiptId, userId);
  const parsed = await parsedLineItemForm(tripId, receiptId, formData);
  const item = await prisma.receiptLineItem.create({
    data: {
      ...lineItemData(parsed),
      receiptId,
      participants: {
        create: parsed.participantIds.map((participantId) => ({ participantId, role: "assigned" }))
      }
    }
  });
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "receipt.line_item_created",
    targetType: "receipt_line_item",
    targetId: item.id,
    metadata: { receiptId, participantCount: parsed.participantIds.length }
  });
  revalidatePath(`/trips/${tripId}/receipts/${receiptId}`);
  redirect(`/trips/${tripId}/receipts/${receiptId}?itemsSaved=1`);
}

export async function updateReceiptLineItem(
  tripId: string,
  receiptId: string,
  lineItemId: string,
  formData: FormData
) {
  if (!getAppConfig().receiptUploadEnabled) redirect(`/trips/${tripId}?error=receipts_disabled`);
  const userId = await requireCurrentUserId();
  await requireEditableReceipt(tripId, receiptId, userId);
  const item = await prisma.receiptLineItem.findFirst({ where: { id: lineItemId, receiptId } });
  if (!item) redirect(`/trips/${tripId}/receipts/${receiptId}?itemError=missing`);
  const parsed = await parsedLineItemForm(tripId, receiptId, formData);
  await prisma.$transaction(async (tx) => {
    await tx.receiptLineItem.update({ where: { id: item.id }, data: lineItemData(parsed) });
    await tx.receiptLineItemParticipant.deleteMany({ where: { lineItemId: item.id } });
    await tx.receiptLineItemParticipant.createMany({
      data: parsed.participantIds.map((participantId) => ({
        lineItemId: item.id,
        participantId,
        role: "assigned"
      }))
    });
  });
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "receipt.line_item_updated",
    targetType: "receipt_line_item",
    targetId: item.id,
    metadata: { receiptId, participantCount: parsed.participantIds.length }
  });
  revalidatePath(`/trips/${tripId}/receipts/${receiptId}`);
  redirect(`/trips/${tripId}/receipts/${receiptId}?itemsSaved=1`);
}

export async function deleteReceiptLineItem(tripId: string, receiptId: string, lineItemId: string) {
  if (!getAppConfig().receiptUploadEnabled) redirect(`/trips/${tripId}?error=receipts_disabled`);
  const userId = await requireCurrentUserId();
  await requireEditableReceipt(tripId, receiptId, userId);
  const deletion = await prisma.receiptLineItem.deleteMany({
    where: { id: lineItemId, receiptId }
  });
  if (deletion.count !== 1) redirect(`/trips/${tripId}/receipts/${receiptId}?itemError=missing`);
  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "receipt.line_item_deleted",
    targetType: "receipt_line_item",
    targetId: lineItemId,
    metadata: { receiptId }
  });
  revalidatePath(`/trips/${tripId}/receipts/${receiptId}`);
  redirect(`/trips/${tripId}/receipts/${receiptId}?itemsSaved=1`);
}

export async function uploadReceipt(tripId: string, formData: FormData) {
  if (!getAppConfig().receiptUploadEnabled) redirect(`/trips/${tripId}?error=receipts_disabled`);

  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  if (!parsedTripId.success) redirect("/dashboard");

  const resolved = await requireTripAccess(tripId, userId);
  if (!canCreateTripExpense(resolved.access.role)) redirect(`/trips/${tripId}?error=forbidden`);

  const file = formData.get("receiptFile");
  if (!(file instanceof File)) redirect(`/trips/${tripId}/receipts/new?error=file`);
  const validation = await validateReceiptFile(file);
  if (!validation.ok) redirect(`/trips/${tripId}/receipts/new?error=${validation.error}`);

  const expenseId = formString(formData, "expenseId") || null;
  if (expenseId) {
    const expense = await prisma.expense.findFirst({ where: { id: expenseId, tripId } });
    if (!expense) redirect(`/trips/${tripId}/receipts/new?error=expense`);
    if (!canEditExpense(resolved.access.role, userId, expense)) {
      redirect(`/trips/${tripId}/receipts/new?error=forbidden`);
    }
  }

  const receiptId = randomUUID();
  const stored = await storeReceiptFile({
    receiptId,
    file,
    extension: validation.extension
  });
  const receipt = await withStoredReceiptCompensation(
    { id: receiptId, storedPath: stored.storedPath },
    async () => {
      const buffer = await readFile(stored.storedPath);
      const parsed = await defaultReceiptParser.parse({
        buffer,
        mimeType: validation.mimeType,
        filename: file.name
      });

      const participants = await prisma.participant.findMany({
        where: { tripId },
        select: { id: true }
      });
      return prisma.receipt.create({
        data: {
          id: receiptId,
          tripId,
          expenseId,
          uploaderUserId: userId,
          originalFilename: safeOriginalFilename(file.name),
          storedFilename: stored.storedFilename,
          storedPath: stored.storedPath,
          mimeType: validation.mimeType,
          fileSize: file.size,
          merchant: parsed.merchant || null,
          receiptDate: parsed.receiptDate || null,
          subtotal: parsedReceiptDecimal(parsed.subtotal),
          tax: parsedReceiptDecimal(parsed.tax),
          tip: parsedReceiptDecimal(parsed.tip),
          total: parsedReceiptDecimal(parsed.total),
          parserProvider: parsed.provider,
          parserConfidence: parsed.confidence,
          rawText: parsed.rawText || null,
          parsedJson: JSON.stringify(parsed),
          status: "needs_review",
          lineItems: {
            create: parsed.lineItems.map((item) => ({
              name: item.name,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: item.unitPrice === undefined ? null : new Prisma.Decimal(item.unitPrice),
              totalPrice: new Prisma.Decimal(item.totalPrice),
              participants: {
                create: participants.map((participant) => ({
                  participantId: participant.id,
                  role: "assigned"
                }))
              }
            }))
          }
        }
      });
    }
  );

  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "receipt.upload",
    targetType: "receipt",
    targetId: receipt.id,
    after: {
      originalFilename: receipt.originalFilename,
      mimeType: receipt.mimeType,
      fileSize: receipt.fileSize
    }
  });
  logger.info("receipt.upload.success", { userId, tripId, receiptId: receipt.id });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/receipts/${receipt.id}`);
}

export async function saveReceiptReview(tripId: string, receiptId: string, formData: FormData) {
  if (!getAppConfig().receiptUploadEnabled) redirect(`/trips/${tripId}?error=receipts_disabled`);

  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedReceiptId = idSchema.safeParse(receiptId);
  if (!parsedTripId.success || !parsedReceiptId.success) redirect("/dashboard");

  const resolved = await requireTripAccess(tripId, userId);
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, tripId } });
  if (!receipt) redirect(`/trips/${tripId}`);
  if (receipt.uploaderUserId !== userId && !isTripManager(resolved.access.role)) {
    redirect(`/trips/${tripId}?error=forbidden`);
  }

  const parsed = receiptReviewSchema.safeParse({
    merchant: formString(formData, "merchant"),
    receiptDate: formString(formData, "receiptDate"),
    subtotal: formString(formData, "subtotal"),
    tax: formString(formData, "tax"),
    tip: formString(formData, "tip"),
    total: formString(formData, "total"),
    status: formString(formData, "status"),
    splitMode: formString(formData, "splitMode")
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] || "amount");
    logger.warn("receipt.review.validation_failed", { userId, tripId, receiptId, field });
    redirect(`/trips/${tripId}/receipts/${receiptId}?error=invalid&field=${field}`);
  }

  const { merchant, status, splitMode } = parsed.data;
  const receiptDate = parseDateInput(parsed.data.receiptDate);

  await prisma.receipt.update({
    where: { id: receiptId },
    data: {
      merchant,
      receiptDate,
      subtotal: parsed.data.subtotal ? new Prisma.Decimal(parsed.data.subtotal.decimal) : null,
      tax: parsed.data.tax ? new Prisma.Decimal(parsed.data.tax.decimal) : null,
      tip: parsed.data.tip ? new Prisma.Decimal(parsed.data.tip.decimal) : null,
      total: parsed.data.total ? new Prisma.Decimal(parsed.data.total.decimal) : null,
      status,
      splitMode
    }
  });

  await writeAuditLog({
    actorUserId: userId,
    tripId,
    action: "receipt.review",
    targetType: "receipt",
    targetId: receiptId,
    before: { status: receipt.status, splitMode: receipt.splitMode },
    after: { status, splitMode }
  });
  revalidatePath(`/trips/${tripId}/receipts/${receiptId}`);
  redirect(`/trips/${tripId}/receipts/${receiptId}?saved=1`);
}

export async function deleteReceipt(tripId: string, receiptId: string) {
  if (!getAppConfig().receiptUploadEnabled) redirect(`/trips/${tripId}?error=receipts_disabled`);

  const userId = await requireCurrentUserId();
  const parsedTripId = idSchema.safeParse(tripId);
  const parsedReceiptId = idSchema.safeParse(receiptId);
  if (!parsedTripId.success || !parsedReceiptId.success) redirect("/dashboard");

  const resolved = await requireTripAccess(tripId, userId);
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, tripId } });
  if (!receipt) redirect(`/trips/${tripId}`);
  if (receipt.uploaderUserId !== userId && !isTripManager(resolved.access.role)) {
    redirect(`/trips/${tripId}?error=forbidden`);
  }

  await prisma.receipt.delete({ where: { id: receiptId } });
  try {
    await writeAuditLog({
      actorUserId: userId,
      tripId,
      action: "receipt.delete",
      targetType: "receipt",
      targetId: receiptId,
      before: { mimeType: receipt.mimeType, fileSize: receipt.fileSize }
    });
  } finally {
    await cleanupStoredReceipts([receipt], "receipt.delete");
  }
  logger.info("receipt.delete.success", { userId, tripId, receiptId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
