import type { MetadataRoute } from "next";
import { getSeoSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSeoSiteUrl();
  if (!siteUrl) return [];

  return [
    {
      url: siteUrl.toString(),
      changeFrequency: "weekly",
      priority: 1
    }
  ];
}
