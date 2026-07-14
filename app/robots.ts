import type { MetadataRoute } from "next";
import { getSeoSiteUrl, PRIVATE_ROUTE_PREFIXES } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSeoSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_ROUTE_PREFIXES]
    },
    host: siteUrl?.origin,
    sitemap: siteUrl ? new URL("/sitemap.xml", siteUrl).toString() : undefined
  };
}
