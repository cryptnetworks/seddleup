import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ArrowRight, Calculator, CheckCircle2, CreditCard, Plane, UsersRound } from "lucide-react";
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
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandLogo href="/" priority />
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href="/login">
            Login
          </Link>
          <Link className="btn-primary hidden sm:inline-flex" href="/register">
            Register
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-5 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-center md:pb-24 md:pt-12">
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-normal text-ocean">
            Travel expenses, handled clearly
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-ink sm:text-5xl md:text-6xl">
            Travel together. Settle up easily.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted md:text-lg">
            SeddleUp keeps group spending, participants, balances, and settlements organized from
            the first booking to the final reimbursement.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link className="btn-primary" href="/register">
              Start a trip <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <Link className="btn-secondary" href="/login">
              I already have an account
            </Link>
          </div>
        </div>

        <div className="card overflow-hidden p-4 md:p-5">
          <div
            className="rounded-lg p-4"
            style={{
              background:
                "linear-gradient(135deg, var(--app-brand-soft), var(--app-card-solid), var(--app-surface))"
            }}
          >
            <BrandLogo className="mx-auto mb-6" priority />
            <div className="grid gap-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    className="rounded-lg border border-line p-4 shadow-sm"
                    style={{ backgroundColor: "var(--app-card)" }}
                    key={feature.title}
                  >
                    <div className="flex gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-ocean">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <h2 className="font-semibold text-ink">{feature.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted">{feature.description}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-normal text-ocean">How it works</p>
            <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
              One clear path from the first booking to the final payment
            </h2>
            <p className="mt-4 leading-7 text-muted">
              SeddleUp keeps the group focused on the trip while the ledger keeps track of the
              details.
            </p>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li className="card p-5" key={step.title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-ocean">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
        <div className="card p-6 sm:p-8">
          <UsersRound className="h-8 w-8 text-ocean" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold text-ink">Built for groups traveling together</h2>
          <p className="mt-3 leading-7 text-muted">
            Use SeddleUp for friend getaways, family vacations, group events, and any trip where
            different people cover different costs.
          </p>
        </div>
        <div className="card p-6 sm:p-8">
          <CheckCircle2 className="h-8 w-8 text-ocean" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold text-ink">
            Flexible splits, understandable results
          </h2>
          <p className="mt-3 leading-7 text-muted">
            Include only the travelers who shared an expense, then see net balances and suggested
            reimbursements without rebuilding the math in a spreadsheet.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-white/70">
        <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 md:py-20">
          <p className="text-sm font-bold uppercase tracking-normal text-ocean">Common questions</p>
          <h2 className="mt-2 text-3xl font-bold text-ink">SeddleUp FAQ</h2>
          <div className="mt-8 grid gap-4">
            {HOMEPAGE_FAQS.map((item) => (
              <article className="card p-5 sm:p-6" key={item.question}>
                <h3 className="text-lg font-semibold text-ink">{item.question}</h3>
                <p className="mt-2 leading-7 text-muted">{item.answer}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center rounded-lg bg-brand-soft p-6 text-center sm:p-8">
            <h2 className="text-2xl font-bold text-ink">Ready for a clearer trip ledger?</h2>
            <p className="mt-2 max-w-xl text-muted">
              Start a trip, add your group, and let SeddleUp calculate the balances.
            </p>
            <Link className="btn-primary mt-5" href="/register">
              Create an account <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} SeddleUp. Travel together. Settle up easily.</p>
        <div className="flex gap-4">
          <Link className="font-semibold text-ocean" href="/login">
            Login
          </Link>
          <Link className="font-semibold text-ocean" href="/register">
            Register
          </Link>
        </div>
      </footer>
    </main>
  );
}
