"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Route, UserCircle } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

export function MobileNav() {
  const pathname = usePathname();
  const linkClass = (href: string) =>
    `flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs font-semibold transition ${
      pathname === href ||
      (href === "/trips" && pathname.startsWith("/trips/") && pathname !== "/trips/new")
        ? "bg-brand-soft text-ocean"
        : "text-muted hover:bg-surface hover:text-ink"
    }`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 max-w-full border-t border-line pb-[max(0.6rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 shadow-soft backdrop-blur-md md:hidden"
      style={{ backgroundColor: "color-mix(in srgb, var(--app-surface) 96%, transparent)" }}
      data-testid="mobile-bottom-nav"
    >
      <div className="mx-auto grid min-w-0 max-w-md grid-cols-5 gap-1">
        <Link
          className={linkClass("/dashboard")}
          data-testid="mobile-nav-dashboard"
          href="/dashboard"
          aria-current={pathname === "/dashboard" ? "page" : undefined}
        >
          <Home className="h-5 w-5" aria-hidden />
          Home
        </Link>
        <Link
          className={linkClass("/trips")}
          data-testid="mobile-nav-trips"
          href="/trips"
          aria-current={
            pathname.startsWith("/trips/") || pathname === "/trips" ? "page" : undefined
          }
        >
          <Route className="h-5 w-5" aria-hidden />
          Trips
        </Link>
        <Link
          className={linkClass("/trips/new")}
          data-testid="mobile-nav-new-trip"
          href="/trips/new"
          aria-current={pathname === "/trips/new" ? "page" : undefined}
        >
          <PlusCircle className="h-5 w-5" aria-hidden />
          New
        </Link>
        <Link
          className={linkClass("/account")}
          data-testid="mobile-nav-account"
          href="/account"
          aria-current={pathname === "/account" ? "page" : undefined}
        >
          <UserCircle className="h-5 w-5" aria-hidden />
          Account
        </Link>
        <LogoutButton variant="mobile" />
      </div>
    </nav>
  );
}
