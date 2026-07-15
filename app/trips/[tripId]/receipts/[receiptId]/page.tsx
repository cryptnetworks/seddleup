import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { saveReceiptReview } from "@/lib/actions";
import { getAppConfig } from "@/lib/config";
import { dateInputValue, formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { isTripManager } from "@/lib/trip-permissions";

export default async function ReceiptReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ tripId: string; receiptId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { tripId, receiptId } = await params;
  const query = await searchParams;
  if (!getAppConfig().receiptUploadEnabled) notFound();

  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);

  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, tripId },
    include: {
      trip: true,
      lineItems: {
        include: {
          participants: { include: { participant: true } }
        }
      }
    }
  });
  if (!receipt) notFound();

  const canEditReceipt = receipt.uploaderUserId === user.id || isTripManager(resolved.access.role);
  const action = saveReceiptReview.bind(null, tripId, receipt.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow={receipt.trip.name}
        title="Review receipt"
        description="Correct parsed fields and decide whether this receipt should be split simply or by item."
      />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section className="card p-4 sm:p-5">
          {query.saved ? (
            <p className="mb-4 rounded-lg bg-brand-soft p-3 text-sm text-ocean">
              Receipt review saved.
            </p>
          ) : null}
          <form className="grid min-w-0 gap-4" action={action}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="merchant">
                  Merchant
                </label>
                <input
                  className="field"
                  disabled={!canEditReceipt}
                  id="merchant"
                  name="merchant"
                  defaultValue={receipt.merchant || ""}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="label" htmlFor="receiptDate">
                  Date
                </label>
                <input
                  className="field"
                  disabled={!canEditReceipt}
                  id="receiptDate"
                  name="receiptDate"
                  type="date"
                  defaultValue={dateInputValue(receipt.receiptDate)}
                />
              </div>
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["subtotal", "tax", "tip", "total"] as const).map((field) => (
                <div key={field}>
                  <label className="label capitalize" htmlFor={field}>
                    {field}
                  </label>
                  <input
                    className="field"
                    disabled={!canEditReceipt}
                    id={field}
                    name={field}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    min="0"
                    step="0.01"
                    defaultValue={receipt[field] ? Number(receipt[field]).toFixed(2) : ""}
                  />
                </div>
              ))}
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="splitMode">
                  Split mode
                </label>
                <select
                  className="field"
                  disabled={!canEditReceipt}
                  id="splitMode"
                  name="splitMode"
                  defaultValue={receipt.splitMode}
                >
                  <option value="simple">Simple receipt total</option>
                  <option value="itemized">Itemized line split</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="status">
                  Review status
                </label>
                <select
                  className="field"
                  disabled={!canEditReceipt}
                  id="status"
                  name="status"
                  defaultValue={receipt.status}
                >
                  <option value="needs_review">Needs review</option>
                  <option value="ready">Ready</option>
                </select>
              </div>
            </div>
            {canEditReceipt ? (
              <button className="btn-primary" type="submit">
                Save review
              </button>
            ) : null}
          </form>
        </section>

        <aside className="grid min-w-0 content-start gap-5">
          <section className="card p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-ink">File</h2>
            <p className="mt-2 break-all text-sm text-muted">{receipt.originalFilename}</p>
            <p className="mt-1 text-xs text-muted">
              {(receipt.fileSize / 1024 / 1024).toFixed(2)} MB - {receipt.mimeType}
            </p>
            <Link
              className="btn-secondary mt-4 w-full sm:w-auto"
              href={`/api/receipts/${receipt.id}/file`}
            >
              Open receipt file
            </Link>
          </section>
          <section className="card p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-ink">Parser</h2>
            <p className="mt-2 text-sm text-muted">
              {receipt.parserProvider} confidence {(receipt.parserConfidence * 100).toFixed(0)}%
            </p>
          </section>
        </aside>
      </div>

      <section className="card mt-5 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink">Line items</h2>
        {receipt.lineItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No line items were detected. Add/edit itemized entries in the next receipt workflow
            pass.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {receipt.lineItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-sm text-muted">
                      Qty {Number(item.quantity).toString()} - assigned to{" "}
                      {
                        item.participants.filter((participant) => participant.role === "assigned")
                          .length
                      }{" "}
                      participant(s)
                    </p>
                  </div>
                  <p className="break-all font-semibold tabular-nums text-ink sm:shrink-0">
                    {formatCurrency(Number(item.totalPrice))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
