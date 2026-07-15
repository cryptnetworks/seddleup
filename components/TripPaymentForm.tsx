import type { Participant, TripPayment } from "@prisma/client";
import { dateInputValue, formatCurrency } from "@/lib/format";

type PaymentParticipant = Pick<Participant, "id" | "name">;
type EditablePayment = Pick<TripPayment, "amount" | "date" | "note"> & {
  sender: PaymentParticipant;
  recipient: PaymentParticipant;
};

function paymentError(error?: string) {
  if (error === "forbidden") return "Only the linked recipient may confirm this payment.";
  if (error === "participants") return "This settlement no longer belongs to this trip.";
  if (error === "stale") return "The outstanding balance changed. Review the latest suggestion.";
  return error ? "Check the payment details and try again." : null;
}

function PaymentHelp() {
  return (
    <div
      className="rounded-lg border border-line bg-surface p-3 text-sm leading-6 text-muted"
      id="trip-payment-help"
    >
      Use this only after you have actually received the money. SeddleUp records your confirmation;
      it does not send, process, or independently verify the payment. This trip uses USD.
    </div>
  );
}

function ErrorMessage({ error }: { error?: string }) {
  const message = paymentError(error);
  return message ? (
    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-coral" role="alert">
      {message}
    </p>
  ) : null;
}

export function TripPaymentConfirmationForm({
  action,
  sender,
  recipient,
  outstandingAmount,
  error
}: {
  action: (formData: FormData) => void | Promise<void>;
  sender: PaymentParticipant;
  recipient: PaymentParticipant;
  outstandingAmount: number;
  error?: string;
}) {
  return (
    <form className="grid min-w-0 gap-4" action={action} data-testid="trip-payment-form">
      <PaymentHelp />
      <ErrorMessage error={error} />
      <input name="senderParticipantId" type="hidden" value={sender.id} />
      <input name="recipientParticipantId" type="hidden" value={recipient.id} />
      <dl className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Paid by</dt>
          <dd className="mt-1 break-words font-semibold text-ink">{sender.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Received by</dt>
          <dd className="mt-1 break-words font-semibold text-ink">{recipient.name}</dd>
        </div>
      </dl>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="label" htmlFor="amount">
            Amount received (USD)
          </label>
          <input
            aria-describedby="trip-payment-help"
            className="field"
            data-testid="trip-payment-amount"
            defaultValue={outstandingAmount.toFixed(2)}
            id="amount"
            inputMode="decimal"
            maxLength={10}
            name="amount"
            pattern="[0-9]+([.,][0-9]{1,2})?"
            required
            type="text"
          />
          <p className="mt-1 text-xs text-muted">
            Up to {formatCurrency(outstandingAmount)} remains outstanding.
          </p>
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor="date">
            Payment date
          </label>
          <input
            className="field"
            data-testid="trip-payment-date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            id="date"
            name="date"
            required
            type="date"
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="note">
          Note (optional)
        </label>
        <textarea
          className="field min-h-28"
          data-testid="trip-payment-note"
          id="note"
          maxLength={500}
          name="note"
        />
      </div>
      <button className="btn-primary min-h-11" data-testid="trip-payment-submit" type="submit">
        Confirm payment received
      </button>
    </form>
  );
}

export function TripPaymentEditForm({
  action,
  payment,
  error
}: {
  action: (formData: FormData) => void | Promise<void>;
  payment: EditablePayment;
  error?: string;
}) {
  return (
    <form className="grid min-w-0 gap-4" action={action} data-testid="trip-payment-form">
      <PaymentHelp />
      <ErrorMessage error={error} />
      <p className="rounded-lg border border-line p-3 text-sm text-ink">
        {payment.recipient.name} confirmed receiving {formatCurrency(Number(payment.amount))} from{" "}
        {payment.sender.name}. To change the parties or amount, delete this confirmation and confirm
        a replacement from the current settlement suggestion.
      </p>
      <div>
        <label className="label" htmlFor="date">
          Payment date
        </label>
        <input
          className="field"
          data-testid="trip-payment-date"
          defaultValue={dateInputValue(payment.date)}
          id="date"
          name="date"
          required
          type="date"
        />
      </div>
      <div>
        <label className="label" htmlFor="note">
          Note (optional)
        </label>
        <textarea
          className="field min-h-28"
          data-testid="trip-payment-note"
          defaultValue={payment.note ?? ""}
          id="note"
          maxLength={500}
          name="note"
        />
      </div>
      <button className="btn-primary min-h-11" data-testid="trip-payment-submit" type="submit">
        Save confirmation details
      </button>
    </form>
  );
}
