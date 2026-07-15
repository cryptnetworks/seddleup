import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrandLogo } from "@/components/BrandLogo";
import { formatCurrency, formatDate } from "@/lib/format";
import { checkTripShareLookupRateLimit, resolveTripShareSummary } from "@/lib/trip-sharing";
import { digestLookupToken } from "@/lib/token-digest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Shared trip summary",
  description: "A limited, read-only SeddleUp trip cost summary.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true }
  }
};

function SharedTripUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <section className="card w-full p-6 text-center sm:p-10" data-testid="share-unavailable">
        <div className="mx-auto mb-6 w-48">
          <BrandLogo />
        </div>
        <h1 className="text-2xl font-bold text-ink">Shared trip unavailable</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
          This sharing link is unavailable. It may be invalid, expired, rotated, revoked, or
          temporarily limited. Ask the trip manager for a current link.
        </p>
      </section>
    </main>
  );
}

export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestHeaders = await headers();
  const requester =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  const requestKey = digestLookupToken(requester).slice(0, 24);
  const rateLimit = checkTripShareLookupRateLimit(requestKey);
  if (!rateLimit.allowed) return <SharedTripUnavailable />;

  const summary = await resolveTripShareSummary(token);
  if (!summary) return <SharedTripUnavailable />;

  return (
    <div className="min-h-screen bg-brand-page">
      <header className="border-b border-line bg-elevated px-4 py-4 sm:px-6">
        <div className="mx-auto flex min-w-0 max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 w-40 sm:w-48">
            <BrandLogo />
          </div>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
            Read-only shared summary
          </span>
        </div>
      </header>

      <main className="mx-auto min-w-0 w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6">
          <p className="text-sm font-semibold text-ocean">Shared trip costs</p>
          <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-ink sm:text-4xl">
            {summary.trip.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {formatDate(summary.trip.startDate)} to {formatDate(summary.trip.endDate)} · Currency:{" "}
            {summary.trip.currency}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            This unlisted page is available to anyone with its bearer link. It does not provide trip
            membership or permission to change SeddleUp data.
          </p>
        </header>

        <section
          className="mb-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3"
          aria-label="Trip totals"
        >
          <div className="card p-3 sm:p-4">
            <p className="text-sm text-muted">Included total</p>
            <p className="mt-1 break-all text-2xl font-bold tabular-nums text-ink">
              {formatCurrency(summary.totalCost)}
            </p>
          </div>
          <div className="card p-3 sm:p-4">
            <p className="text-sm text-muted">Included expenses</p>
            <p className="mt-1 text-2xl font-bold text-ink">{summary.expenses.length}</p>
          </div>
          <div className="card p-3 min-[360px]:col-span-2 sm:col-span-1 sm:p-4">
            <p className="text-sm text-muted">Participants</p>
            <p className="mt-1 text-2xl font-bold text-ink">{summary.balances.length}</p>
          </div>
        </section>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
          <section className="card p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-ink">Included expenses</h2>
            <p className="mt-1 text-sm text-muted">
              Draft expenses and internal notes are excluded.
            </p>
            {summary.expenses.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No shareable expenses yet.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {summary.expenses.map((expense, index) => (
                  <article
                    className="rounded-lg border border-line p-4"
                    data-testid="shared-expense"
                    key={`${expense.title}-${expense.date.toISOString()}-${index}`}
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-ink">{expense.title}</h3>
                        <p className="mt-1 text-sm text-muted">
                          {expense.category} · {formatDate(expense.date)} · {expense.status}
                        </p>
                      </div>
                      <div className="min-w-0 text-left sm:max-w-[45%] sm:text-right">
                        <p className="break-all font-bold tabular-nums text-ink">
                          {formatCurrency(expense.amount)}
                        </p>
                        <p className="break-words text-xs text-muted">
                          Paid by {expense.payerName}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="grid min-w-0 content-start gap-6">
            <section className="card p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-ink">Participant totals</h2>
              <div className="mt-4 grid gap-3">
                {summary.balances.map((balance, index) => (
                  <article
                    className="rounded-lg border border-line p-3"
                    data-testid="shared-balance"
                    key={`${balance.participantName}-${index}`}
                  >
                    <h3 className="font-semibold text-ink">{balance.participantName}</h3>
                    <p className="mt-1 text-sm text-muted">
                      Paid {formatCurrency(balance.paid)} · Share {formatCurrency(balance.owed)}
                    </p>
                    <p className="mt-1 break-all font-bold tabular-nums text-ink">
                      Net {formatCurrency(balance.net)}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="card p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-ink">Settlement summary</h2>
              {summary.settlements.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No settlements are needed.</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {summary.settlements.map((settlement, index) => (
                    <p
                      className="rounded-lg border border-line p-3 text-sm text-ink"
                      data-testid="shared-settlement"
                      key={`${settlement.debtorName}-${settlement.creditorName}-${index}`}
                    >
                      {settlement.debtorName} owes {settlement.creditorName}{" "}
                      {formatCurrency(settlement.amount)}
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-muted">
                Payment handles and payment links are never included.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
