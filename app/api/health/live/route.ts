import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      data: {
        service: "seddleup",
        status: "live"
      },
      time: new Date().toISOString()
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
