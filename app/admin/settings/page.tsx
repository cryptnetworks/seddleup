import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { updateLocalAuthSettings } from "@/lib/actions";
import { requireAdmin } from "@/lib/authorization";
import { getAuthSettings } from "@/lib/settings";

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const settings = await getAuthSettings();

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Control local authentication, registration, email verification, and default account policy."
      />
      {query.error ? <p className="alert-error mb-4">Settings rejected: {query.error}.</p> : null}
      <form className="card grid gap-4 p-5" action={updateLocalAuthSettings}>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink">
          <input
            name="localAuthEnabled"
            type="checkbox"
            defaultChecked={settings.localAuthEnabled}
          />
          Enable local email/password login
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink">
          <input
            name="publicRegistrationEnabled"
            type="checkbox"
            defaultChecked={settings.publicRegistrationEnabled}
          />
          Enable public registration
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink">
          <input
            name="requireEmailVerification"
            type="checkbox"
            defaultChecked={settings.requireEmailVerification}
          />
          Require email verification
        </label>
        <div>
          <label className="label" htmlFor="allowedEmailDomains">
            Allowed email domains
          </label>
          <input
            className="field"
            id="allowedEmailDomains"
            name="allowedEmailDomains"
            defaultValue={settings.allowedEmailDomains.join(", ")}
            placeholder="example.com, company.org"
          />
          <p className="mt-1 text-xs text-muted">Leave empty to allow all domains.</p>
        </div>
        <div>
          <label className="label" htmlFor="defaultUserRole">
            Default user role
          </label>
          <select
            className="field"
            id="defaultUserRole"
            name="defaultUserRole"
            defaultValue={settings.defaultUserRole}
          >
            <option value="user">User</option>
            <option value="readonly">Readonly</option>
          </select>
        </div>
        <button className="btn-primary" type="submit">
          Save settings
        </button>
      </form>
    </AdminShell>
  );
}
