import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarketingLayout from "@/app/(marketing)/layout";
import RootLayout from "@/app/layout";
import {
  CLOUDFLARE_WEB_ANALYTICS_SRC,
  CLOUDFLARE_WEB_ANALYTICS_TOKEN,
  CloudflareWebAnalytics
} from "@/components/CloudflareWebAnalytics";

describe("Cloudflare Web Analytics", () => {
  it("renders the global module beacon with the configured site token", () => {
    const markup = renderToStaticMarkup(createElement(CloudflareWebAnalytics));

    expect(markup).toContain('type="module"');
    expect(markup).toContain(`src="${CLOUDFLARE_WEB_ANALYTICS_SRC}"`);
    expect(markup).toContain(
      `data-cf-beacon="{&quot;token&quot;:&quot;${CLOUDFLARE_WEB_ANALYTICS_TOKEN}&quot;}"`
    );
  });

  it("loads analytics only through the public marketing layout", () => {
    const rootMarkup = renderToStaticMarkup(
      createElement(RootLayout, null, createElement("main", null, "Sensitive route"))
    );
    const marketingMarkup = renderToStaticMarkup(
      createElement(MarketingLayout, null, createElement("main", null, "Public homepage"))
    );

    expect(rootMarkup).not.toContain(CLOUDFLARE_WEB_ANALYTICS_SRC);
    expect(marketingMarkup).toContain(CLOUDFLARE_WEB_ANALYTICS_SRC);
  });
});
