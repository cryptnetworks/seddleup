import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { uploadReceipt } from "@/lib/actions";
import { getAppConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { canCreateTripExpense } from "@/lib/trip-permissions";

export default async function NewReceiptPage({
  params,
  searchParams
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tripId } = await params;
  const query = await searchParams;
  if (!getAppConfig().receiptUploadEnabled) notFound();

  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);
  if (!canCreateTripExpense(resolved.access.role)) notFound();
  const canManageTrip = resolved.access.role === "owner" || resolved.access.role === "admin";

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      expenses: {
        where: canManageTrip
          ? { status: { not: "settled" } }
          : { createdByUserId: user.id, status: { not: "settled" } },
        orderBy: { date: "desc" }
      }
    }
  });
  if (!trip) notFound();

  const action = uploadReceipt.bind(null, trip.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow={trip.name}
        title="Upload receipt"
        description="Attach a local receipt file, parse what we can, then review the details before saving."
      />
      <section className="card mx-auto max-w-2xl p-4 sm:p-5">
        {query.error ? (
          <p className="status-danger mb-4">Receipt upload failed: {query.error}.</p>
        ) : null}
        <form className="grid min-w-0 gap-4" action={action}>
          <div>
            <label className="label" htmlFor="receiptFile">
              Receipt file
            </label>
            <input
              className="field"
              id="receiptFile"
              name="receiptFile"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="expenseId">
              Attach to expense
            </label>
            <select className="field" id="expenseId" name="expenseId" defaultValue="">
              <option value="">Create receipt without expense link</option>
              {trip.expenses.map((expense) => (
                <option key={expense.id} value={expense.id}>
                  {expense.title}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" type="submit">
            Upload and parse
          </button>
        </form>
      </section>
    </PageShell>
  );
}
