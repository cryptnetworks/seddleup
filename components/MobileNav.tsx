"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Route, UserCircle } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

export function MobileNav() {
  const pathname = usePathname();
  const linkClass = (active: boolean) =>
    `flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean ${
      active ? "bg-brand-soft text-ocean" : "text-muted hover:bg-surface hover:text-ink"
    }`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 max-w-full border-t border-line bg-elevated pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 md:hidden"
      data-testid="mobile-bottom-nav"
    >
      <div className="mx-auto grid min-w-0 max-w-md grid-cols-5 gap-1">
        <Link
          className={linkClass(pathname === "/dashboard")}
          aria-current={pathname === "/dashboard" ? "page" : undefined}
          data-testid="mobile-nav-dashboard"
          href="/dashboard"
        >
          <Home className="h-5 w-5" aria-hidden />
          Home
        </Link>
        <Link
          className={linkClass(
            pathname !== "/trips/new" && (pathname === "/trips" || pathname.startsWith("/trips/"))
          )}
          aria-current={
            pathname !== "/trips/new" && (pathname === "/trips" || pathname.startsWith("/trips/"))
              ? "page"
              : undefined
          }
          data-testid="mobile-nav-trips"
          href="/trips"
        >
          <Route className="h-5 w-5" aria-hidden />
          Trips
        </Link>
        <Link
          className={linkClass(pathname === "/trips/new")}
          aria-current={pathname === "/trips/new" ? "page" : undefined}
          data-testid="mobile-nav-new-trip"
          href="/trips/new"
        >
          <PlusCircle className="h-5 w-5" aria-hidden />
          New
        </Link>
        <Link
          className={linkClass(pathname === "/account")}
          aria-current={pathname === "/account" ? "page" : undefined}
          data-testid="mobile-nav-account"
          href="/account"
        >
          <UserCircle className="h-5 w-5" aria-hidden />
          Account
        </Link>
        <LogoutButton variant="mobile" />
      </div>
    </nav>
  );
}
