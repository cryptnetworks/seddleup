import { NextResponse } from "next/server";
import { testOAuthEnabled } from "@/lib/oauth-providers";

export async function GET(request: Request) {
  if (!testOAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  if (!redirectUri || !state) {
    return NextResponse.json({ error: "Invalid OAuth request" }, { status: 400 });
  }

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", "test-oauth-code");
  callbackUrl.searchParams.set("state", state);
  return NextResponse.redirect(callbackUrl);
}
