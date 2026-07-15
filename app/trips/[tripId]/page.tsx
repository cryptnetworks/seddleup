import Link from "next/link";
import { notFound } from "next/navigation";
import { BalanceCard } from "@/components/BalanceCard";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseCard } from "@/components/ExpenseCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { SettlementList } from "@/components/SettlementList";
import { TripPaymentCard } from "@/components/TripPaymentCard";
import { auditActionLabel } from "@/lib/audit";
import { calculateBalances } from "@/lib/calculations";
import { createParticipant, deleteParticipant, deleteTrip } from "@/lib/actions";
import { getAppConfig } from "@/lib/config";
import { formatCurrency, formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import {
  canCreateTripExpense,
  canConfirmTripPayment,
  canEditExpense,
  canEditConfirmedTripPayment,
  canIncludeExpenseInBalances,
  canViewExpense,
  isTripManager
} from "@/lib/trip-permissions";

export default async function TripDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { tripId } = await params;
  const { filter = "all" } = await searchParams;
  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  const role = resolved.access.role;
  const canManageTrip = isTripManager(role);
  const canAddExpense = canCreateTripExpense(role);
  const receiptsEnabled = getAppConfig().receiptUploadEnabled;
  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: {
      participants: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            include: {
              paymentMethods: {
                where: { enabled: true, visibility: "trip_members" },
                orderBy: { createdAt: "asc" }
              }
            }
          }
        }
      },
      expenses: {
        orderBy: { date: "desc" },
        include: {
          payer: true,
          createdBy: { select: { username: true, email: true } },
          shares: { include: { participant: true } }
        }
      },
      payments: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          sender: true,
          recipient: true,
          confirmedBy: { select: { username: true } }
        }
      },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });

  if (!trip) notFound();

  const visibleExpenses = trip.expenses.filter((expense) => canViewExpense(role, user.id, expense));
  const filteredExpenses = visibleExpenses.filter((expense) => {
    if (filter === "my") return expense.createdByUserId === user.id;
    if (filter === "needs-review") return ["draft", "submitted"].includes(expense.status);
    if (filter === "disputed") return expense.status === "disputed";
    if (filter === "unsettled") return expense.status !== "draft" && expense.status !== "settled";
    return true;
  });
  const balanceExpenses = visibleExpenses.filter((expense) =>
    canIncludeExpenseInBalances(expense.status)
  );
  const { balances, settlements } = calculateBalances(
    trip.participants,
    balanceExpenses,
    trip.payments
  );
  const participantById = new Map(
    trip.participants.map((participant) => [participant.id, participant] as const)
  );
  const confirmableSettlementKeys = settlements
    .filter((settlement) => {
      const recipient = participantById.get(settlement.creditorId);
      return (
        recipient &&
        canConfirmTripPayment(role, user.id, {
          senderParticipantId: settlement.debtorId,
          recipientParticipantId: settlement.creditorId,
          recipientParticipantUserId: recipient.userId
        })
      );
    })
    .map((settlement) => `${settlement.debtorId}:${settlement.creditorId}`);
  logger.info("settlement.calculate.success", {
    userId: user.id,
    tripId: trip.id,
    participants: trip.participants.length,
    expenses: balanceExpenses.length,
    payments: trip.payments.length,
    settlements: settlements.length
  });
  const totalCost = balanceExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const paymentMethodsByParticipantId = Object.fromEntries(
    trip.participants.map((participant) => [
      participant.id,
      (participant.user?.paymentMethods || []).map((method) => ({
        provider: method.provider,
        label: method.label,
        handle: method.handle,
        url: method.url,
        notes: method.notes
      }))
    ])
  );
  const addParticipant = createParticipant.bind(null, trip.id);
  const removeTrip = deleteTrip.bind(null, trip.id);
  const filters = [
    ["all", "All expenses"],
    ["my", "My expenses"],
    ["needs-review", "Needs review"],
    ["disputed", "Disputed"],
    ["unsettled", "Unsettled"]
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Trip summary"
        title={trip.name}
        description={`${trip.destination || "Destination pending"} - ${formatDate(trip.startDate)} to ${formatDate(trip.endDate)}`}
      />

      <div className="mb-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canAddExpense ? (
          <Link
            className="btn-primary w-full sm:w-auto"
            data-testid="add-expense"
            href={`/trips/${trip.id}/expenses/new`}
          >
            Add Expense
          </Link>
        ) : null}
        {canAddExpense && receiptsEnabled ? (
          <Link className="btn-secondary w-full sm:w-auto" href={`/trips/${trip.id}/receipts/new`}>
            Upload Receipt
          </Link>
        ) : null}
        {canManageTrip ? (
          <>
            <Link
              className="btn-secondary w-full sm:w-auto"
              data-testid="edit-trip"
              href={`/trips/${trip.id}/edit`}
            >
              Edit Trip
            </Link>
            <Link
              className="btn-secondary w-full whitespace-normal sm:w-auto"
              data-testid="share-trip"
              href={`/trips/${trip.id}/share`}
            >
              Share read-only summary
            </Link>
            <form action={removeTrip}>
              <button
                className="btn-danger w-full sm:w-auto"
                data-testid="delete-trip"
                type="submit"
              >
                Delete Trip
              </button>
            </form>
          </>
        ) : null}
      </div>

      <section className="mb-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <div className="card p-3 sm:p-4">
          <p className="text-sm text-muted">Total cost</p>
          <p className="mt-1 break-all text-2xl font-bold tabular-nums">
            {formatCurrency(totalCost)}
          </p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-sm text-muted">Participants</p>
          <p className="mt-1 text-2xl font-bold">{trip.participants.length}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-sm text-muted">Expenses</p>
          <p className="mt-1 text-2xl font-bold">{balanceExpenses.length}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-sm text-muted">Balances</p>
          <p className="mt-1 text-2xl font-bold">{balances.length}</p>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="grid min-w-0 gap-5">
          <section className="card min-w-0 p-3 sm:p-4">
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Participants</h2>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
                {trip.participants.length} total
              </span>
            </div>
            {canManageTrip ? (
              <form
                className="mb-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                action={addParticipant}
                data-testid="participant-form"
              >
                <input
                  className="field"
                  data-testid="participant-name"
                  name="name"
                  placeholder="Name"
                  maxLength={120}
                  required
                />
                <input
                  className="field"
                  data-testid="participant-email"
                  name="email"
                  placeholder="Email optional"
                  type="email"
                  maxLength={120}
                />
                <button className="btn-primary" data-testid="participant-submit" type="submit">
                  Add
                </button>
              </form>
            ) : null}
            {trip.participants.length === 0 ? (
              <p className="text-sm text-muted">Add travelers before recording expenses.</p>
            ) : (
              <div className="grid gap-3">
                {trip.participants.map((participant) => {
                  const removeParticipant = deleteParticipant.bind(null, trip.id, participant.id);
                  return (
                    <div
                      key={participant.id}
                      className="flex min-w-0 flex-col items-stretch gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between"
                      data-testid="participant-card"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-ink">{participant.name}</p>
                        <p className="break-all text-sm text-muted">
                          {participant.email || "No email provided"}
                          {participant.userId ? " - linked app user" : ""}
                        </p>
                      </div>
                      {canManageTrip ? (
                        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
                          <Link
                            className="btn-secondary min-h-11 px-3 py-1.5"
                            data-testid="participant-edit"
                            href={`/trips/${trip.id}/participants/${participant.id}/edit`}
                          >
                            Edit
                          </Link>
                          <DeleteButton
                            action={removeParticipant}
                            label={`Delete ${participant.name}`}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card min-w-0 p-3 sm:p-4">
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Expense history</h2>
              {canAddExpense ? (
                <Link
                  className="text-sm font-semibold text-ocean"
                  data-testid="add-expense-inline"
                  href={`/trips/${trip.id}/expenses/new`}
                >
                  Add expense
                </Link>
              ) : null}
            </div>
            <nav
              aria-label="Expense filters"
              className="mb-4 flex w-full min-w-0 max-w-full snap-x gap-2 overflow-x-auto overscroll-x-contain pb-2 focus-within:ring-2 focus-within:ring-ocean focus-within:ring-offset-2"
              data-testid="expense-filters"
            >
              {filters.map(([value, label]) => (
                <Link
                  key={value}
                  className={`min-h-11 shrink-0 snap-start rounded-full border px-3 py-2.5 text-sm font-semibold focus:outline-none ${
                    filter === value
                      ? "border-ocean bg-ocean text-white"
                      : "border-line bg-surface text-muted"
                  }`}
                  href={`/trips/${trip.id}?filter=${value}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
            {filteredExpenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description="Add an expense after you have at least one participant."
                actionLabel="Add expense"
                actionHref={`/trips/${trip.id}/expenses/new`}
              />
            ) : (
              <div className="grid gap-3">
                {filteredExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    tripId={trip.id}
                    canEdit={canEditExpense(role, user.id, expense)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card min-w-0 p-3 sm:p-4" data-testid="trip-payment-history">
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Confirmed payments</h2>
                <p className="mt-1 text-sm text-muted">
                  Recipient confirmations that adjust balances without changing expenses.
                </p>
              </div>
            </div>
            {trip.payments.length === 0 ? (
              <p className="text-sm text-muted">No payments have been confirmed yet.</p>
            ) : (
              <div className="grid gap-3">
                {trip.payments.map((payment) => (
                  <TripPaymentCard
                    key={payment.id}
                    canEdit={canEditConfirmedTripPayment(role, user.id, {
                      confirmedByUserId: payment.confirmedByUserId,
                      recipientParticipantUserId: payment.recipient.userId
                    })}
                    payment={payment}
                    tripId={trip.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <section className="card p-3 sm:p-4">
            <h2 className="mb-4 text-lg font-semibold text-ink">Balances</h2>
            {balances.length === 0 ? (
              <p className="text-sm text-muted">
                Add participants and expenses to calculate balances.
              </p>
            ) : (
              <div className="grid gap-3">
                {balances.map((balance) => (
                  <BalanceCard key={balance.participant.id} balance={balance} />
                ))}
              </div>
            )}
          </section>
          <section className="card p-3 sm:p-4">
            <h2 className="mb-4 text-lg font-semibold text-ink">Settlement suggestions</h2>
            <SettlementList
              settlements={settlements}
              paymentMethodsByParticipantId={paymentMethodsByParticipantId}
              confirmableSettlementKeys={confirmableSettlementKeys}
              tripId={trip.id}
            />
          </section>
          <section className="card p-3 sm:p-4" data-testid="trip-activity">
            <h2 className="mb-4 text-lg font-semibold text-ink">Trip activity</h2>
            {trip.auditLogs.length === 0 ? (
              <p className="text-sm text-muted">
                Expense and participant changes will appear here.
              </p>
            ) : (
              <div className="grid gap-3">
                {trip.auditLogs.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-line p-3">
                    <p className="text-sm font-semibold text-ink">
                      {auditActionLabel(entry.action)}
                    </p>
                    <p className="text-xs text-muted">{formatDate(entry.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
