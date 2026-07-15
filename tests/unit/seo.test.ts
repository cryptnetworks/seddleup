import { afterEach, describe, expect, it, vi } from "vitest";
import { metadata as accountMetadata } from "@/app/account/layout";
import { metadata as adminMetadata } from "@/app/admin/layout";
import { metadata as authMetadata } from "@/app/(auth)/layout";
import { metadata as dashboardMetadata } from "@/app/dashboard/layout";
import { metadata as inviteMetadata } from "@/app/invite/layout";
import manifest from "@/app/manifest";
import { metadata as offlineMetadata } from "@/app/offline/layout";
import robots from "@/app/robots";
import { metadata as shareMetadata } from "@/app/share/layout";
import sitemap from "@/app/sitemap";
import { metadata as tripsMetadata } from "@/app/trips/layout";
import {
  buildHomepageMetadata,
  buildHomepageStructuredData,
  buildRootMetadata,
  getSeoSiteUrl,
  HOMEPAGE_FAQS,
  PRIVATE_PAGE_METADATA,
  PRIVATE_ROUTE_PREFIXES,
  serializeJsonLd,
  SITE_DESCRIPTION
} from "@/lib/seo";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
  GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION,
  BING_SITE_VERIFICATION: process.env.BING_SITE_VERIFICATION
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  restoreEnvironment();
});

describe("SEO site URL", () => {
  it("normalizes a configured HTTPS production origin", () => {
    expect(
      getSeoSiteUrl({
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://travel.example.com/nested/path?ignored=1"
      })?.toString()
    ).toBe("https://travel.example.com/");
  });

  it.each([undefined, "http://travel.example.com", "https://localhost:3000", "not-a-url"])(
    "does not publish an unsafe production origin: %s",
    (PUBLIC_APP_URL) => {
      expect(getSeoSiteUrl({ NODE_ENV: "production", PUBLIC_APP_URL })).toBeNull();
    }
  );

  it("keeps a localhost fallback for development only", () => {
    expect(getSeoSiteUrl({ NODE_ENV: "development" })?.toString()).toBe("http://localhost:3000/");
  });
});

describe("SEO metadata", () => {
  it("builds canonical, social, and optional verification metadata from one origin", () => {
    const environment = {
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://travel.example.com",
      GOOGLE_SITE_VERIFICATION: "google-token",
      BING_SITE_VERIFICATION: "bing-token"
    };
    const root = buildRootMetadata(environment);
    const homepage = buildHomepageMetadata(environment);

    expect(root.metadataBase?.toString()).toBe("https://travel.example.com/");
    expect(root.verification).toEqual({
      google: "google-token",
      other: { "msvalidate.01": "bing-token" }
    });
    expect(root.openGraph).toEqual(
      expect.objectContaining({
        url: "https://travel.example.com/",
        images: [
          expect.objectContaining({
            url: "https://travel.example.com/branding/og-image.png",
            width: 1024,
            height: 1024
          })
        ]
      })
    );
    expect(homepage.alternates).toEqual({ canonical: "https://travel.example.com/" });
  });

  it("does not emit localhost canonical or social URLs for a misconfigured production site", () => {
    const root = buildRootMetadata({ NODE_ENV: "production", PUBLIC_APP_URL: "" });
    const homepage = buildHomepageMetadata({ NODE_ENV: "production", PUBLIC_APP_URL: "" });

    expect(root.metadataBase).toBeUndefined();
    expect(root.openGraph).toEqual(expect.objectContaining({ url: undefined, images: [] }));
    expect(homepage.alternates).toBeUndefined();
  });

  it("marks private pages noindex and nofollow", () => {
    expect(PRIVATE_PAGE_METADATA.robots).toEqual(
      expect.objectContaining({ index: false, follow: false, nocache: true })
    );

    expect([
      accountMetadata,
      adminMetadata,
      authMetadata,
      dashboardMetadata,
      inviteMetadata,
      offlineMetadata,
      shareMetadata,
      tripsMetadata
    ]).toEqual(Array.from({ length: 8 }, () => PRIVATE_PAGE_METADATA));
  });
});

describe("SEO routes and structured data", () => {
  it("includes only the public homepage in the sitemap", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", "https://travel.example.com");

    expect(sitemap()).toEqual([
      {
        url: "https://travel.example.com/",
        changeFrequency: "weekly",
        priority: 1
      }
    ]);
  });

  it("allows the homepage, blocks every private route prefix, and references the sitemap", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", "https://travel.example.com");

    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_ROUTE_PREFIXES]
      },
      host: "https://travel.example.com",
      sitemap: "https://travel.example.com/sitemap.xml"
    });
  });

  it("keeps visible FAQ content and JSON-LD answers identical", () => {
    const structuredData = buildHomepageStructuredData({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://travel.example.com"
    });
    const faq = structuredData?.["@graph"].find((item) => item["@type"] === "FAQPage");

    expect(structuredData?.["@graph"].map((item) => item["@type"])).toEqual([
      "WebSite",
      "SoftwareApplication",
      "FAQPage"
    ]);
    expect(faq).toEqual({
      "@type": "FAQPage",
      mainEntity: HOMEPAGE_FAQS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    });
    expect(serializeJsonLd({ value: "</script>" })).toContain("\\u003c/script>");
  });

  it("uses one generated manifest with product-consistent copy", () => {
    expect(manifest()).toEqual(
      expect.objectContaining({
        name: "SeddleUp",
        short_name: "SeddleUp",
        description: SITE_DESCRIPTION,
        start_url: "/",
        scope: "/"
      })
    );
  });
});
