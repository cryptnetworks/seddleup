import type { Expense, Participant } from "@prisma/client";
import Link from "next/link";
import { Pencil, ReceiptText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

type ExpenseCardProps = {
  expense: Expense & {
    payer: Participant;
    createdBy?: { username: string; email: string } | null;
    shares: { participant: Participant; shareAmount: unknown }[];
  };
  tripId: string;
  canEdit?: boolean;
};

export function ExpenseCard({ expense, tripId, canEdit = true }: ExpenseCardProps) {
  const statusTone =
    expense.status === "settled" || expense.status === "approved"
      ? "success"
      : expense.status === "disputed"
        ? "danger"
        : expense.status === "submitted"
          ? "warning"
          : "neutral";

  return (
    <article
      className="rounded-xl border border-line bg-surface p-4 transition hover:border-ocean/30"
      data-testid="expense-card"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-ocean">
            <ReceiptText className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 break-words text-base font-semibold text-ink">
                {expense.title}
              </h3>
              <StatusBadge tone={statusTone}>{expense.status}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {expense.category} - {formatDate(expense.date)}
            </p>
          </div>
        </div>
        <div className="min-w-0 text-left sm:max-w-[45%] sm:text-right">
          <p className="break-all font-bold tabular-nums text-ink">
            {formatCurrency(Number(expense.amount))}
          </p>
          <p className="break-words text-xs text-muted">Paid by {expense.payer.name}</p>
        </div>
      </div>
      {expense.notes ? (
        <p className="mt-3 break-words text-sm leading-6 text-muted">{expense.notes}</p>
      ) : null}
      <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-words text-xs text-muted">
          Uploaded by {expense.createdBy?.username || "Unknown"} - shared by {expense.shares.length}{" "}
          participant{expense.shares.length === 1 ? "" : "s"}
        </p>
        {canEdit ? (
          <Link
            href={`/trips/${tripId}/expenses/${expense.id}/edit`}
            className="icon-button self-end sm:self-auto"
            aria-label={`Edit ${expense.title}`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
