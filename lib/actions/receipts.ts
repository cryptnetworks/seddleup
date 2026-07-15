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
  receiptReviewSchema
} from "@/lib/validation";

function parsedReceiptDecimal(value: number | undefined) {
  if (value === undefined) return null;
  return new Prisma.Decimal(optionalUsdMoneySchema.parse(String(value))?.decimal ?? "0.00");
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
