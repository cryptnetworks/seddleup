import type { Metadata } from "next";

export const SITE_NAME = "SeddleUp";
export const SITE_TITLE = "SeddleUp | Group Travel Expense Tracker";
export const SITE_DESCRIPTION =
  "SeddleUp helps groups track shared travel expenses, split costs, calculate balances, and settle up.";
export const SOCIAL_IMAGE_PATH = "/branding/og-image.png";

export const PRIVATE_ROUTE_PREFIXES = [
  "/api/",
  "/admin/",
  "/account/",
  "/dashboard/",
  "/trips/",
  "/invite/",
  "/share/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/offline"
] as const;

export const HOMEPAGE_FAQS = [
  {
    question: "What does SeddleUp track?",
    answer:
      "SeddleUp keeps trip participants, shared expenses, who paid, who shared each cost, balances, and suggested reimbursements in one ledger."
  },
  {
    question: "Can each expense be split between different travelers?",
    answer:
      "Yes. Each expense can include only the travelers who shared it, so a meal, room, ticket, or ride does not have to be divided across the whole group."
  },
  {
    question: "Does SeddleUp move money between travelers?",
    answer:
      "No. SeddleUp calculates balances and suggests who should reimburse whom, but travelers complete payments outside the app."
  }
] as const;

export const PRIVATE_PAGE_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export type SeoEnvironment = {
  NODE_ENV?: string;
  PUBLIC_APP_URL?: string;
  GOOGLE_SITE_VERIFICATION?: string;
  BING_SITE_VERIFICATION?: string;
};

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "[::1]" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".localhost")
  );
}

export function getSeoSiteUrl(environment: SeoEnvironment = process.env): URL | null {
  const configured = environment.PUBLIC_APP_URL?.trim();

  if (!configured) {
    return environment.NODE_ENV === "production" ? null : new URL("http://localhost:3000/");
  }

  try {
    const parsed = new URL(configured);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      return null;
    }

    if (
      environment.NODE_ENV === "production" &&
      (parsed.protocol !== "https:" || isLocalHostname(parsed.hostname))
    ) {
      return null;
    }

    return new URL(`${parsed.origin}/`);
  } catch {
    return null;
  }
}

export function getAbsoluteSeoUrl(
  path: string,
  environment: SeoEnvironment = process.env
): string | null {
  const siteUrl = getSeoSiteUrl(environment);
  return siteUrl ? new URL(path, siteUrl).toString() : null;
}

function verificationMetadata(environment: SeoEnvironment): Metadata["verification"] {
  const google = environment.GOOGLE_SITE_VERIFICATION?.trim() || undefined;
  const bing = environment.BING_SITE_VERIFICATION?.trim() || undefined;

  if (!google && !bing) return undefined;

  return {
    google,
    other: bing ? { "msvalidate.01": bing } : undefined
  };
}

function socialImage(siteUrl: URL | null) {
  if (!siteUrl) return [];
  return [
    {
      url: new URL(SOCIAL_IMAGE_PATH, siteUrl).toString(),
      width: 1024,
      height: 1024,
      alt: "SeddleUp group travel expense tracker"
    }
  ];
}

export function buildRootMetadata(environment: SeoEnvironment = process.env): Metadata {
  const siteUrl = getSeoSiteUrl(environment);
  const images = socialImage(siteUrl);

  return {
    metadataBase: siteUrl || undefined,
    title: {
      default: SITE_TITLE,
      template: "%s | SeddleUp"
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "Travel",
    manifest: "/manifest.webmanifest",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      siteName: SITE_NAME,
      url: siteUrl?.toString(),
      images,
      locale: "en_US",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: images.map((image) => image.url)
    },
    verification: verificationMetadata(environment),
    appleWebApp: {
      capable: true,
      title: SITE_NAME,
      statusBarStyle: "default",
      startupImage: ["/apple-touch-icon.png"]
    },
    icons: {
      icon: [{ url: "/favicon.ico" }, { url: "/favicon.svg", type: "image/svg+xml" }],
      apple: "/apple-touch-icon.png"
    }
  };
}

export function buildHomepageMetadata(environment: SeoEnvironment = process.env): Metadata {
  const siteUrl = getSeoSiteUrl(environment);
  const canonical = siteUrl?.toString();
  const images = socialImage(siteUrl);

  return {
    title: { absolute: SITE_TITLE },
    description: SITE_DESCRIPTION,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      siteName: SITE_NAME,
      url: canonical,
      images,
      locale: "en_US",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: images.map((image) => image.url)
    }
  };
}

export function buildHomepageStructuredData(environment: SeoEnvironment = process.env) {
  const siteUrl = getSeoSiteUrl(environment);
  if (!siteUrl) return null;

  const homepageUrl = siteUrl.toString();
  const websiteId = new URL("#website", siteUrl).toString();
  const softwareId = new URL("#software", siteUrl).toString();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: homepageUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en"
      },
      {
        "@type": "SoftwareApplication",
        "@id": softwareId,
        url: homepageUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        applicationCategory: "FinanceApplication",
        applicationSubCategory: "Travel expense management",
        operatingSystem: "Web"
      },
      {
        "@type": "FAQPage",
        mainEntity: HOMEPAGE_FAQS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer
          }
        }))
      }
    ]
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
