import { ShieldCheck } from "lucide-react";
import { AppNavLink } from "@/components/AppNavLink";
import { PageShell } from "@/components/PageShell";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/auth", label: "Authentication" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit Log" }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card h-fit min-w-0 p-3">
          <div className="mb-3 flex items-center gap-2 px-2 py-1 text-sm font-bold text-ink">
            <ShieldCheck className="h-4 w-4 text-ocean" aria-hidden />
            Admin
          </div>
          <nav
            className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain pb-1 lg:grid"
            aria-label="Admin"
          >
            {adminLinks.map((link) => (
              <AppNavLink
                key={link.href}
                className="shrink-0"
                href={link.href}
                section={link.href !== "/admin"}
              >
                {link.label}
              </AppNavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </PageShell>
  );
}
