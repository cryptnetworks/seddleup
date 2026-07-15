import type { Participant, TripPayment, User } from "@prisma/client";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";

type PaymentCardPayment = TripPayment & {
  sender: Pick<Participant, "name">;
  recipient: Pick<Participant, "name">;
  confirmedBy: Pick<User, "username"> | null;
};

export function TripPaymentCard({
  payment,
  tripId,
  canEdit
}: {
  payment: PaymentCardPayment;
  tripId: string;
  canEdit: boolean;
}) {
  return (
    <article
      className="rounded-xl border border-line bg-surface p-3 sm:p-4"
      data-testid="trip-payment-card"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-ink">
            {payment.recipient.name} confirmed receiving {formatCurrency(Number(payment.amount))}{" "}
            from {payment.sender.name}.
          </h3>
          <p className="mt-1 text-sm text-muted">
            Payment date {formatDate(payment.date)} · Confirmed by{" "}
            {payment.confirmedBy?.username ?? "former user"} on {formatDate(payment.confirmedAt)}
          </p>
          {payment.note ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
              {payment.note}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 shrink-0 sm:text-right">
          {canEdit ? (
            <Link
              className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ocean"
              href={`/trips/${tripId}/payments/${payment.id}/edit`}
            >
              Edit confirmation
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
