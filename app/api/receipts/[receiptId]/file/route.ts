import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReceiptPathInsideUploadDir } from "@/lib/receipts/storage";
import { requireUser } from "@/lib/session";
import { resolveTripAccess } from "@/lib/trip-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const user = await requireUser();
  const { receiptId } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await resolveTripAccess(receipt.tripId, user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let resolvedPath: string;
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    resolvedPath = resolveReceiptPathInsideUploadDir(receipt.storedPath);
    fileStat = await stat(resolvedPath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = createReadStream(resolvedPath);
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "content-type": receipt.mimeType,
      "content-length": String(fileStat.size),
      "content-disposition": `inline; filename="${receipt.storedFilename}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache"
    }
  });
}
