"use client";

import Link from "next/link";
import { Home, PlusCircle, Route, UserCircle } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 max-w-full border-t border-line pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 shadow-soft backdrop-blur md:hidden"
      style={{ backgroundColor: "var(--app-card)" }}
      data-testid="mobile-bottom-nav"
    >
      <div className="mx-auto grid min-w-0 max-w-md grid-cols-5 gap-1">
        <Link
          className="flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium text-muted focus:outline-none focus:ring-2 focus:ring-ocean"
          data-testid="mobile-nav-dashboard"
          href="/dashboard"
        >
          <Home className="h-5 w-5" aria-hidden />
          Home
        </Link>
        <Link
          className="flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium text-muted focus:outline-none focus:ring-2 focus:ring-ocean"
          data-testid="mobile-nav-trips"
          href="/trips"
        >
          <Route className="h-5 w-5" aria-hidden />
          Trips
        </Link>
        <Link
          className="flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium text-ocean focus:outline-none focus:ring-2 focus:ring-ocean"
          data-testid="mobile-nav-new-trip"
          href="/trips/new"
        >
          <PlusCircle className="h-5 w-5" aria-hidden />
          New
        </Link>
        <Link
          className="flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium text-muted focus:outline-none focus:ring-2 focus:ring-ocean"
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
