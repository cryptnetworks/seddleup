import { headers } from "next/headers";
import { logger } from "@/lib/logger";
import { publicBaseUrl } from "@/lib/url";

function originFromHeader(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function requestOriginFromHeaders(input: Headers) {
  const forwardedHost = input.get("x-forwarded-host");
  const host = forwardedHost || input.get("host");
  if (!host) return null;

  const forwardedProto = input.get("x-forwarded-proto");
  const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}

export function isSameOriginRequest(input: Headers) {
  const allowedOrigins = new Set<string>();
  const requestOrigin = requestOriginFromHeaders(input);
  if (requestOrigin) allowedOrigins.add(requestOrigin);
  allowedOrigins.add(publicBaseUrl({ headers: input } as Request));

  const origin = originFromHeader(input.get("origin"));
  if (origin) return allowedOrigins.has(origin);

  const referer = originFromHeader(input.get("referer"));
  if (referer) return allowedOrigins.has(referer);

  return false;
}

export async function assertSameOriginRequest(action: string) {
  const requestHeaders = await headers();
  if (isSameOriginRequest(requestHeaders)) return;

  logger.warn("security.csrf.blocked", { action });
  throw new Error("Invalid request origin.");
}
