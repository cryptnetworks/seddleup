"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUserId } from "@/lib/actions/session";
import { logger } from "@/lib/logger";
import {
  confirmTripPaymentForUser,
  deleteConfirmedTripPaymentForUser,
  editConfirmedTripPaymentForUser,
  type TripPaymentMutationFailure
} from "@/lib/trip-payments";
import {
  formString,
  idSchema,
  tripPaymentConfirmationSchema,
  tripPaymentEditSchema
} from "@/lib/validation";

type ActionFailure = TripPaymentMutationFailure | "invalid";

function paymentPath(tripId: string, paymentId?: string) {
  return paymentId
    ? `/trips/${tripId}/payments/${paymentId}/edit`
    : `/trips/${tripId}/payments/new`;
}

function redirectFailure(tripId: string, failure: ActionFailure, paymentId?: string): never {
  if (failure === "not-found") redirect(`/trips/${tripId}`);
  redirect(`${paymentPath(tripId, paymentId)}?error=${failure}`);
}

export async function createTripPayment(tripId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  if (!idSchema.safeParse(tripId).success) redirect("/dashboard");
  const parsed = tripPaymentConfirmationSchema.safeParse({
    senderParticipantId: formString(formData, "senderParticipantId"),
    recipientParticipantId: formString(formData, "recipientParticipantId"),
    amount: formString(formData, "amount"),
    date: formString(formData, "date"),
    note: formString(formData, "note")
  });
  if (!parsed.success) {
    logger.warn("trip_payment.confirm.validation_failed", { userId, tripId });
    redirectFailure(tripId, "invalid");
  }

  const result = await confirmTripPaymentForUser(tripId, userId, parsed.data);
  if (!result.ok) {
    logger.warn("trip_payment.confirm.denied", { userId, tripId, reason: result.reason });
    redirectFailure(tripId, result.reason);
  }

  logger.info("trip_payment.confirm.success", {
    userId,
    tripId,
    paymentId: result.value.paymentId
  });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?payment=confirmed`);
}

export async function updateTripPayment(tripId: string, paymentId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  if (!idSchema.safeParse(tripId).success || !idSchema.safeParse(paymentId).success) {
    redirect("/dashboard");
  }
  const parsed = tripPaymentEditSchema.safeParse({
    date: formString(formData, "date"),
    note: formString(formData, "note")
  });
  if (!parsed.success) {
    logger.warn("trip_payment.update.validation_failed", { userId, tripId, paymentId });
    redirectFailure(tripId, "invalid", paymentId);
  }

  const result = await editConfirmedTripPaymentForUser(tripId, paymentId, userId, parsed.data);
  if (!result.ok) {
    logger.warn("trip_payment.update.denied", {
      userId,
      tripId,
      paymentId,
      reason: result.reason
    });
    redirectFailure(tripId, result.reason, paymentId);
  }

  logger.info("trip_payment.update.success", { userId, tripId, paymentId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?payment=updated`);
}

export async function deleteTripPayment(tripId: string, paymentId: string) {
  const userId = await requireCurrentUserId();
  if (!idSchema.safeParse(tripId).success || !idSchema.safeParse(paymentId).success) {
    redirect("/dashboard");
  }

  const result = await deleteConfirmedTripPaymentForUser(tripId, paymentId, userId);
  if (!result.ok) {
    logger.warn("trip_payment.delete.denied", {
      userId,
      tripId,
      paymentId,
      reason: result.reason
    });
    redirect(`/trips/${tripId}?error=${result.reason}`);
  }

  logger.info("trip_payment.delete.success", { userId, tripId, paymentId });
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?payment=deleted`);
}
