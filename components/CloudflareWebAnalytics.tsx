export const CLOUDFLARE_WEB_ANALYTICS_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
export const CLOUDFLARE_WEB_ANALYTICS_TOKEN = "a4d17d159f3e4d3f83a2e69785cb66e0";

export function CloudflareWebAnalytics() {
  return (
    <script
      type="module"
      defer
      src={CLOUDFLARE_WEB_ANALYTICS_SRC}
      data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_WEB_ANALYTICS_TOKEN })}
    />
  );
}
