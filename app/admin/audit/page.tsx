import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; action?: string; page?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page || "1"));
  const pageSize = 30;
  const where = {
    action: query.action ? { contains: query.action } : undefined,
    OR: query.q
      ? [
          { action: { contains: query.q } },
          { targetType: { contains: query.q } },
          { targetId: { contains: query.q } },
          { metadataJson: { contains: query.q } }
        ]
      : undefined
  };
  const [events, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true } } }
    }),
    prisma.auditLog.count({ where })
  ]);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        description="Review security and administration events across the system."
      />
      <form className="card mb-4 grid gap-3 p-4 md:grid-cols-3">
        <input
          className="field"
          name="q"
          placeholder="Search events"
          defaultValue={query.q || ""}
        />
        <input
          className="field"
          name="action"
          placeholder="Filter action"
          defaultValue={query.action || ""}
        />
        <button className="btn-primary" type="submit">
          Filter
        </button>
      </form>
      <div className="grid gap-3">
        {events.map((event) => (
          <article key={event.id} className="card p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold text-ink">{event.action}</h2>
                <p className="text-sm text-muted">
                  {event.targetType}
                  {event.targetId ? ` · ${event.targetId}` : ""} · {event.actor?.email || "System"}
                </p>
              </div>
              <p className="text-xs text-muted">{event.createdAt.toLocaleString()}</p>
            </div>
            {event.metadataJson ? (
              <pre className="mt-3 max-w-full overflow-x-auto rounded-lg bg-surface p-3 text-xs text-muted">
                {event.metadataJson}
              </pre>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Showing {events.length} of {total} events.
      </p>
    </AdminShell>
  );
}
