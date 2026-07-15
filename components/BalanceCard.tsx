import type { ParticipantWithBalances } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";

export function BalanceCard({ balance }: { balance: ParticipantWithBalances }) {
  const isPositive = balance.net >= 0;

  return (
    <article className="card p-4" data-testid="balance-card">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 break-words font-semibold text-ink">
          {balance.participant.name}
        </h3>
        <span
          className={
            isPositive
              ? "rounded-lg bg-success-soft px-2.5 py-1 text-xs font-semibold text-success"
              : "rounded-lg bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger"
          }
        >
          {isPositive ? "Reimburse" : "Owes"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Paid {formatCurrency(balance.paid)}, owes {formatCurrency(balance.owed)}
      </p>
      <p
        className={`${isPositive ? "text-success" : "text-danger"} mt-2 break-all text-2xl font-bold tabular-nums`}
      >
        {formatCurrency(balance.net)}
      </p>
    </article>
  );
}
