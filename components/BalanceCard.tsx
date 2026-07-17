import type { ParticipantWithBalances } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export function BalanceCard({ balance }: { balance: ParticipantWithBalances }) {
  const isNeutral = Math.abs(balance.net) < 0.005;
  const isPositive = balance.net > 0;

  return (
    <article className="rounded-xl border border-line bg-surface p-4" data-testid="balance-card">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 break-words font-semibold text-ink">
          {balance.participant.name}
        </h3>
        <StatusBadge tone={isNeutral ? "neutral" : isPositive ? "success" : "danger"}>
          {isNeutral ? "Settled" : isPositive ? "Is owed" : "Owes"}
        </StatusBadge>
      </div>
      <p className="mt-2 text-sm text-muted">
        Paid {formatCurrency(balance.paid)}, owes {formatCurrency(balance.owed)}
      </p>
      <p className="mt-1 text-xs text-muted">
        Payments sent {formatCurrency(balance.sent)} · received {formatCurrency(balance.received)}
      </p>
      <p
        className={`${isNeutral ? "text-muted" : isPositive ? "text-success" : "text-coral"} mt-2 break-all text-2xl font-bold tabular-nums`}
      >
        {formatCurrency(balance.net)} remaining
      </p>
    </article>
  );
}
