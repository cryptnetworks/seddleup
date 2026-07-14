import type { Settlement } from "@/lib/calculations";
import { paymentProviderLabel, type SettlementPaymentMethod } from "@/lib/payments";
import { isSafeHttpUrl } from "@/lib/url";

export function SettlementList({
  settlements,
  paymentMethodsByParticipantId = {}
}: {
  settlements: Settlement[];
  paymentMethodsByParticipantId?: Record<string, SettlementPaymentMethod[]>;
}) {
  if (settlements.length === 0) {
    return (
      <div className="card p-4 text-sm text-muted" data-testid="settlement-empty">
        No settlement recommendations yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {settlements.map((settlement) => (
        <div
          key={`${settlement.debtorId}-${settlement.creditorId}-${settlement.amount}`}
          className="card p-4 text-sm font-medium text-ink"
          data-testid="settlement-card"
        >
          <p className="break-words">{settlement.label}</p>
          {paymentMethodsByParticipantId[settlement.creditorId]?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {paymentMethodsByParticipantId[settlement.creditorId].map((method) =>
                method.url && isSafeHttpUrl(method.url) ? (
                  <a
                    key={`${method.provider}-${method.url}`}
                    className="btn-secondary min-h-11 whitespace-normal px-3 py-1.5"
                    href={method.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Pay with {paymentProviderLabel(method.provider)}
                  </a>
                ) : (
                  <span
                    key={`${method.provider}-${method.handle}`}
                    className="max-w-full break-all rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted"
                  >
                    {paymentProviderLabel(method.provider)}: {method.handle}
                  </span>
                )
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
