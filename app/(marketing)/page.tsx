import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  CreditCard,
  Plane,
  UsersRound
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { authOptions } from "@/lib/auth";
import {
  buildHomepageMetadata,
  buildHomepageStructuredData,
  HOMEPAGE_FAQS,
  serializeJsonLd
} from "@/lib/seo";

export const metadata: Metadata = buildHomepageMetadata();

const features = [
  {
    title: "Track every shared cost",
    description: "Log meals, stays, tickets, and transport as the trip happens.",
    icon: CreditCard
  },
  {
    title: "Split with the right people",
    description: "Choose who shared each expense and keep balances accurate.",
    icon: Calculator
  },
  {
    title: "Settle up faster",
    description: "See simple reimbursement suggestions before everyone heads home.",
    icon: Plane
  }
];

const steps = [
  {
    title: "Create the trip",
    description: "Add the travelers who should appear in the shared expense ledger."
  },
  {
    title: "Record shared expenses",
    description: "Log who paid and choose exactly which travelers shared each cost."
  },
  {
    title: "Review balances and settle up",
    description: "Use the calculated balances and reimbursement suggestions to close the trip."
  }
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const structuredData = buildHomepageStructuredData();

  return (
    <main className="min-h-screen bg-brand-page">
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        />
      ) : null}

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <BrandLogo href="/" priority />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account">
          <Link className="nav-link" href="/login">
            Login
          </Link>
          <Link className="btn-primary" href="/register">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-20 pt-10 sm:px-6 md:pb-28 md:pt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(30rem,1.1fr)] lg:items-center lg:gap-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.14em] text-ocean">
            A calmer way to share trip costs
          </p>
          <h1 className="text-5xl font-bold leading-[1.02] tracking-[-0.045em] text-ink sm:text-6xl lg:text-7xl">
            Travel together.
            <span className="mt-1 block text-ocean">Settle up clearly.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            SeddleUp keeps group spending, participants, balances, and settlements organized from
            the first booking to the final reimbursement.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="btn-primary" href="/register">
              Start a trip <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link className="btn-secondary" href="/login">
              I already have an account
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-ocean" aria-hidden /> Private by default
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-ocean" aria-hidden /> Self-hosted
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-ocean" aria-hidden /> Built for real groups
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="card overflow-hidden p-3 shadow-soft sm:p-4">
            <div className="flex items-center justify-between border-b border-line px-2 pb-4 pt-1 sm:px-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  Trip overview
                </p>
                <h2 className="mt-1 text-lg font-bold tracking-tight text-ink">Lisbon weekend</h2>
              </div>
              <span className="badge-success">On track</span>
            </div>
            <div className="grid gap-3 py-4 sm:grid-cols-3">
              <div className="rounded-xl bg-surface p-3">
                <p className="text-xs text-muted">Total spend</p>
                <p className="mt-1 text-xl font-bold text-ink">$1,284</p>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <p className="text-xs text-muted">Travelers</p>
                <p className="mt-1 text-xl font-bold text-ink">4</p>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <p className="text-xs text-muted">Expenses</p>
                <p className="mt-1 text-xl font-bold text-ink">12</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink">Recent expenses</h2>
                  <span className="text-xs font-semibold text-ocean">View all</span>
                </div>
                {[
                  ["Apartment", "Paid by Maya", "$620.00"],
                  ["Dinner at Prado", "Paid by Alex", "$186.40"],
                  ["Airport transfer", "Paid by Jordan", "$74.00"]
                ].map(([title, meta, amount]) => (
                  <div
                    className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-0 first:pt-0 last:pb-0"
                    key={title}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{title}</p>
                      <p className="text-xs text-muted">{meta}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-ink">{amount}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-brand-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ocean">
                  Next settlement
                </p>
                <p className="mt-6 text-3xl font-bold tracking-tight text-ink">$92.30</p>
                <p className="mt-1 text-sm text-muted">Alex pays Maya</p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-ocean">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Ready to confirm
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line" style={{ backgroundColor: "var(--app-surface)" }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ocean">
                Everything in one ledger
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Less spreadsheet work. More time for the trip.
              </h2>
              <p className="mt-4 leading-7 text-muted">
                A focused workspace keeps every shared cost understandable without turning travel
                planning into accounting software.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article className="rounded-xl border border-line p-5" key={feature.title}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-ocean">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 font-bold text-ink">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ocean">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            One clear path from the first booking to the final payment
          </h2>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li className="card p-6" key={step.title}>
              <span className="text-sm font-bold text-ocean">0{index + 1}</span>
              <h3 className="mt-8 text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line" style={{ backgroundColor: "var(--app-surface)" }}>
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24 lg:px-8">
          <div className="rounded-xl bg-surface p-6 sm:p-8">
            <UsersRound className="h-7 w-7 text-ocean" aria-hidden />
            <h2 className="mt-8 text-2xl font-bold tracking-tight text-ink">
              Built for groups traveling together
            </h2>
            <p className="mt-3 leading-7 text-muted">
              Use SeddleUp for friend getaways, family vacations, group events, and any trip where
              different people cover different costs.
            </p>
          </div>
          <div className="rounded-xl bg-surface p-6 sm:p-8">
            <CheckCircle2 className="h-7 w-7 text-ocean" aria-hidden />
            <h2 className="mt-8 text-2xl font-bold tracking-tight text-ink">
              Flexible splits, understandable results
            </h2>
            <p className="mt-3 leading-7 text-muted">
              Include only the travelers who shared an expense, then see net balances and suggested
              reimbursements without rebuilding the math in a spreadsheet.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 md:py-24">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ocean">
            Common questions
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            SeddleUp FAQ
          </h2>
        </div>
        <div className="mt-10 grid gap-3">
          {HOMEPAGE_FAQS.map((item) => (
            <article className="card p-5 sm:p-6" key={item.question}>
              <h3 className="text-lg font-bold text-ink">{item.question}</h3>
              <p className="mt-2 leading-7 text-muted">{item.answer}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center rounded-2xl bg-brand-soft p-7 text-center sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Ready for a clearer trip ledger?
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Start a trip, add your group, and let SeddleUp calculate the balances.
          </p>
          <Link className="btn-primary mt-6" href="/register">
            Create an account <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} SeddleUp. Travel together. Settle up easily.</p>
          <div className="flex gap-5">
            <Link className="font-semibold text-ocean hover:underline" href="/login">
              Login
            </Link>
            <Link className="font-semibold text-ocean hover:underline" href="/register">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
