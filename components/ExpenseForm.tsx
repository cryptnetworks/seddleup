import type { Expense, ExpenseShare, Participant } from "@prisma/client";
import { ItemLookupBox } from "@/components/item-lookup/ItemLookupBox";
import { categories, dateInputValue } from "@/lib/format";

type ExpenseFormParticipant = Pick<Participant, "id" | "name">;

type ExpenseFormExpense = Pick<
  Expense,
  "title" | "amount" | "category" | "payerId" | "date" | "status" | "notes"
> & {
  shares: Pick<ExpenseShare, "participantId">[];
};

type ExpenseFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  participants: ExpenseFormParticipant[];
  payerOptions: ExpenseFormParticipant[];
  statusOptions: string[];
  submitLabel: string;
  expense?: ExpenseFormExpense;
};

export function ExpenseForm({
  action,
  participants,
  payerOptions,
  statusOptions,
  submitLabel,
  expense
}: ExpenseFormProps) {
  const sharedIds = new Set(expense?.shares.map((share) => share.participantId));

  return (
    <form className="grid gap-4" action={action} data-testid="expense-form">
      <ItemLookupBox />
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input
          className="field"
          data-testid="expense-title"
          id="title"
          name="title"
          defaultValue={expense?.title}
          maxLength={140}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="amount">
            Amount
          </label>
          <input
            className="field"
            data-testid="expense-amount"
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            min="0.01"
            step="0.01"
            defaultValue={expense ? Number(expense.amount).toFixed(2) : undefined}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select
            className="field"
            data-testid="expense-category"
            id="category"
            name="category"
            defaultValue={expense?.category}
            required
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="payerId">
            Payer
          </label>
          <select
            className="field"
            data-testid="expense-payer"
            id="payerId"
            name="payerId"
            defaultValue={expense?.payerId}
            required
          >
            {payerOptions.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input
            className="field"
            data-testid="expense-date"
            id="date"
            name="date"
            type="date"
            defaultValue={
              expense ? dateInputValue(expense.date) : new Date().toISOString().slice(0, 10)
            }
            required
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="status">
          Status
        </label>
        <select
          className="field"
          id="status"
          name="status"
          defaultValue={expense?.status ?? "submitted"}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend className="label">Shared by</legend>
        <div className="grid gap-2 sm:grid-cols-2" data-testid="expense-shares">
          {participants.map((participant) => (
            <label
              key={participant.id}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <input
                data-testid="expense-share-checkbox"
                name="sharedParticipantIds"
                type="checkbox"
                value={participant.id}
                defaultChecked={expense ? sharedIds.has(participant.id) : true}
              />
              {participant.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea
          className="field min-h-28"
          data-testid="expense-notes"
          id="notes"
          name="notes"
          defaultValue={expense?.notes || ""}
          maxLength={500}
        />
      </div>
      <button className="btn-primary" data-testid="expense-submit" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
