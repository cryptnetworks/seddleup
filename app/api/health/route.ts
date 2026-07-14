import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { checkReadiness } from "@/lib/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = await checkReadiness();
  const ready = readiness.status === "ready";

  if (!ready) {
    logger.warn("readiness.failed", { check: readiness.failedCheck });
  }

  return NextResponse.json(
    {
      ok: ready,
      data: {
        service: "seddleup",
        status: readiness.status,
        checks: readiness.checks
      },
      ...(ready ? {} : { error: { message: "Service is not ready" } }),
      time: new Date().toISOString()
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
