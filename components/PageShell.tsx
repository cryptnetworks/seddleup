import { getServerSession } from "next-auth";
import { AccountMenu } from "@/components/AccountMenu";
import { AppNavLink } from "@/components/AppNavLink";
import { BrandLogo } from "@/components/BrandLogo";
import { MobileNav } from "@/components/MobileNav";
import { authOptions } from "@/lib/auth";
import { isAdminRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function PageShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })
    : null;

  return (
    <div className="min-h-screen min-w-0 max-w-full bg-brand-page pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-10 min-w-0 max-w-full border-b border-line bg-elevated py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:px-6">
        <div className="mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-3">
          <BrandLogo href="/dashboard" priority />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <AppNavLink href="/dashboard">Dashboard</AppNavLink>
            <AppNavLink href="/trips" section>
              Trips
            </AppNavLink>
            <AppNavLink href="/trips/new" prominent>
              New trip
            </AppNavLink>
            {isAdminRole(currentUser?.role) ? (
              <AppNavLink href="/admin" section>
                Admin
              </AppNavLink>
            ) : null}
            <AccountMenu name={session?.user?.name} email={session?.user?.email} />
          </nav>
        </div>
      </header>
      <main className="mx-auto min-w-0 w-full max-w-6xl px-4 py-5 sm:px-6 md:py-8">{children}</main>
      <MobileNav />
    </div>
  );
}
