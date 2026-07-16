import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import {
  createReceiptLineItem,
  deleteReceipt,
  deleteReceiptLineItem,
  saveReceiptReview,
  updateReceiptLineItem
} from "@/lib/actions";
import { getAppConfig } from "@/lib/config";
import { categories, dateInputValue, formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { calculateReceiptItemizedShares } from "@/lib/receipts/splitting";
import { requireUser } from "@/lib/session";
import { requireTripAccess } from "@/lib/trip-access";
import { isTripManager } from "@/lib/trip-permissions";

export default async function ReceiptReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ tripId: string; receiptId: string }>;
  searchParams: Promise<{
    saved?: string;
    itemsSaved?: string;
    itemError?: string;
    error?: string;
    field?: string;
  }>;
}) {
  const { tripId, receiptId } = await params;
  const query = await searchParams;
  if (!getAppConfig().receiptUploadEnabled) notFound();

  const user = await requireUser();
  const resolved = await requireTripAccess(tripId, user.id);

  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, tripId },
    include: {
      trip: { include: { participants: { orderBy: { name: "asc" } } } },
      expense: true,
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
  const removeReceipt = deleteReceipt.bind(null, tripId, receipt.id);
  const assignedLineItems = receipt.lineItems.map((item) => ({
    id: item.id,
    totalPrice: Number(item.totalPrice),
    assignedParticipantIds: item.participants
      .filter((assignment) => assignment.role === "assigned")
      .map((assignment) => assignment.participantId)
  }));
  const itemizedShares = calculateReceiptItemizedShares({
    lineItems: assignedLineItems,
    participantIds: receipt.trip.participants.map((participant) => participant.id),
    tax: Number(receipt.tax || 0),
    tip: Number(receipt.tip || 0),
    adjustments: Number(receipt.adjustments || 0)
  });
  const allocatedTotal = Object.values(itemizedShares).reduce((sum, share) => sum + share, 0);

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
              {receipt.status === "ready"
                ? "Receipt review and linked expense saved."
                : "Receipt review saved. Confirm the refreshed split preview before marking it ready."}
            </p>
          ) : null}
          {query.error && query.error !== "invalid" ? (
            <p className="mb-4 rounded-lg bg-surface p-3 text-sm text-coral" role="alert">
              {query.error === "stale"
                ? "This receipt changed in another request. Review the latest values and try again."
                : query.error === "preview"
                  ? "Save these values as Needs review, confirm the refreshed split preview, then mark the receipt ready."
                  : query.error === "reconciliation"
                    ? "Item totals, tax, tip, and adjustments must equal the reviewed total."
                    : query.error === "assignments"
                      ? "Every item needs at least one traveler before itemized review can be completed."
                      : "Choose a valid payer and complete the required expense fields."}
            </p>
          ) : null}
          <form className="grid min-w-0 gap-4" action={action}>
            <input name="expectedUpdatedAt" type="hidden" value={receipt.updatedAt.toISOString()} />
            <input
              name="expectedExpenseUpdatedAt"
              type="hidden"
              value={receipt.expense?.updatedAt.toISOString() || ""}
            />
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
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(["subtotal", "tax", "tip", "adjustments", "total"] as const).map((field) => (
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
                    aria-describedby={
                      query.error && query.field === field ? `${field}-error` : undefined
                    }
                    aria-invalid={query.error && query.field === field ? true : undefined}
                  />
                  {query.error && query.field === field ? (
                    <p className="mt-1 text-sm text-coral" id={`${field}-error`}>
                      Enter a valid non-negative USD amount with at most two decimal places.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="payerId">
                  Paid by
                </label>
                <select
                  className="field"
                  disabled={!canEditReceipt}
                  id="payerId"
                  name="payerId"
                  defaultValue={
                    receipt.expense?.payerId ||
                    receipt.trip.participants.find((participant) => participant.userId === user.id)
                      ?.id ||
                    receipt.trip.participants[0]?.id ||
                    ""
                  }
                >
                  <option disabled value="">
                    Select a payer
                  </option>
                  {receipt.trip.participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="category">
                  Expense category
                </label>
                <select
                  className="field"
                  disabled={!canEditReceipt}
                  id="category"
                  name="category"
                  defaultValue={receipt.expense?.category || "Other"}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
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
            {receipt.expense ? (
              <Link className="text-sm font-medium text-ocean underline" href={`/trips/${tripId}`}>
                View linked expense
              </Link>
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
            {canEditReceipt ? (
              <form action={removeReceipt} className="mt-3">
                <button className="btn-danger w-full sm:w-auto" type="submit">
                  Delete receipt
                </button>
              </form>
            ) : null}
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
        <p className="mt-1 text-sm text-muted">
          Select every traveler sharing an item. Unselected travelers are excluded; an item cannot
          be saved without at least one assignment.
        </p>
        {query.itemsSaved ? (
          <p className="mt-3 rounded-lg bg-brand-soft p-3 text-sm text-ocean" role="status">
            Line items saved.
          </p>
        ) : null}
        {query.itemError ? (
          <p className="mt-3 rounded-lg bg-surface p-3 text-sm text-coral" role="alert">
            Line item not saved. Check its values and choose travelers from this trip.
          </p>
        ) : null}
        {receipt.lineItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No line items were detected.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {receipt.lineItems.map((item) => (
              <article
                key={item.id}
                className="min-w-0 rounded-lg border border-line bg-surface p-3"
              >
                <form
                  action={updateReceiptLineItem.bind(null, tripId, receipt.id, item.id)}
                  className="grid min-w-0 gap-3"
                >
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-medium text-ink sm:col-span-2">
                      Item name
                      <input
                        className="field mt-1"
                        defaultValue={item.name}
                        disabled={!canEditReceipt}
                        name="name"
                        required
                      />
                    </label>
                    <label className="text-sm font-medium text-ink">
                      Quantity
                      <input
                        className="field mt-1"
                        defaultValue={Number(item.quantity).toString()}
                        disabled={!canEditReceipt}
                        inputMode="decimal"
                        name="quantity"
                        required
                      />
                    </label>
                    <label className="text-sm font-medium text-ink">
                      Total
                      <input
                        className="field mt-1"
                        defaultValue={Number(item.totalPrice).toFixed(2)}
                        disabled={!canEditReceipt}
                        inputMode="decimal"
                        name="totalPrice"
                        required
                      />
                    </label>
                    <label className="text-sm font-medium text-ink">
                      Unit price (optional)
                      <input
                        className="field mt-1"
                        defaultValue={item.unitPrice ? Number(item.unitPrice).toFixed(2) : ""}
                        disabled={!canEditReceipt}
                        inputMode="decimal"
                        name="unitPrice"
                      />
                    </label>
                  </div>
                  <fieldset className="min-w-0">
                    <legend className="text-sm font-medium text-ink">
                      Travelers sharing this item
                    </legend>
                    <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {receipt.trip.participants.map((participant) => (
                        <label
                          className="flex min-w-0 items-center gap-2 text-sm"
                          key={participant.id}
                        >
                          <input
                            defaultChecked={item.participants.some(
                              (assignment) =>
                                assignment.role === "assigned" &&
                                assignment.participantId === participant.id
                            )}
                            disabled={!canEditReceipt}
                            name="participantIds"
                            type="checkbox"
                            value={participant.id}
                          />
                          <span className="min-w-0 break-words">{participant.name}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {canEditReceipt ? (
                    <button className="btn-secondary w-full sm:w-auto" type="submit">
                      Save item
                    </button>
                  ) : null}
                </form>
                {canEditReceipt ? (
                  <form
                    action={deleteReceiptLineItem.bind(null, tripId, receipt.id, item.id)}
                    className="mt-2"
                  >
                    <button className="btn-danger w-full sm:w-auto" type="submit">
                      Delete item
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
        {canEditReceipt ? (
          <form
            action={createReceiptLineItem.bind(null, tripId, receipt.id)}
            className="mt-4 grid min-w-0 gap-3 rounded-lg border border-dashed border-line p-3"
          >
            <h3 className="font-semibold text-ink">Add line item</h3>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input className="field sm:col-span-2" name="name" placeholder="Item name" required />
              <input
                className="field"
                inputMode="decimal"
                name="quantity"
                defaultValue="1"
                required
              />
              <input
                className="field"
                inputMode="decimal"
                name="totalPrice"
                placeholder="Total"
                required
              />
              <input
                className="field"
                inputMode="decimal"
                name="unitPrice"
                placeholder="Unit price (optional)"
              />
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Travelers sharing this item</legend>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {receipt.trip.participants.map((participant) => (
                  <label className="flex min-w-0 items-center gap-2 text-sm" key={participant.id}>
                    <input name="participantIds" type="checkbox" value={participant.id} />
                    <span className="min-w-0 break-words">{participant.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="btn-primary w-full sm:w-auto" type="submit">
              Add item
            </button>
          </form>
        ) : null}
        {receipt.lineItems.length > 0 ? (
          <div className="mt-5 rounded-lg border border-line p-3">
            <h3 className="font-semibold text-ink">Itemized split preview</h3>
            <div className="mt-2 grid gap-1 text-sm">
              {receipt.trip.participants.map((participant) => (
                <p className="flex justify-between gap-3" key={participant.id}>
                  <span className="min-w-0 break-words">{participant.name}</span>
                  <strong className="shrink-0 tabular-nums">
                    {formatCurrency(itemizedShares[participant.id] || 0)}
                  </strong>
                </p>
              ))}
            </div>
            <p className="mt-3 border-t border-line pt-2 text-sm text-muted">
              Allocated {formatCurrency(allocatedTotal)} from item totals plus tax, tip, and
              adjustments. Saving as Ready creates one linked expense or updates that same expense
              on later saves. Unselected travelers receive no share of that item.
            </p>
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
