import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TripCard } from "@/components/TripCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canIncludeExpenseInBalances } from "@/lib/trip-permissions";

export default async function DashboardPage() {
  const user = await requireUser();
  const trips = await prisma.trip.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: {
      participants: true,
      expenses: {
        where: {
          OR: [{ status: { not: "draft" } }, { createdByUserId: user.id }]
        }
      }
    }
  });

  const totalParticipants = trips.reduce((sum, trip) => sum + trip.participants.length, 0);
  const totalExpenses = trips.reduce(
    (sum, trip) =>
      sum +
      trip.expenses
        .filter((expense) => canIncludeExpenseInBalances(expense.status))
        .reduce((inner, expense) => inner + Number(expense.amount), 0),
    0
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="SeddleUp"
        title="Dashboard"
        description="Review your trips, people, spending, and settlement status in one place."
        action={{ label: "Create Trip", href: "/trips/new" }}
      />

      <section className="mb-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <StatCard compact label="Total trips" value={trips.length} />
        <StatCard compact label="Participants" value={totalParticipants} />
        <StatCard compact label="Expenses" value={formatCurrency(totalExpenses)} />
        <StatCard compact label="Active trips" value={trips.length} />
      </section>

      {trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Create your first trip to track participants, expenses, balances, and reimbursements."
          actionLabel="Create your first trip"
          actionHref="/trips/new"
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Recent trips</h2>
            <Link className="text-sm font-semibold text-ocean" href="/trips">
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {trips.slice(0, 4).map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
