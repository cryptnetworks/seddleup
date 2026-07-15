import { logger } from "@/lib/logger";
import { deleteReceiptDirectory } from "@/lib/receipts/storage";

export type StoredReceiptReference = {
  id: string;
  storedPath: string;
};

export async function cleanupStoredReceipts(
  receipts: StoredReceiptReference[],
  operation: "upload.compensation" | "receipt.delete" | "trip.delete" | "user.delete"
) {
  const failedReceiptIds: string[] = [];
  for (const receipt of receipts) {
    try {
      await deleteReceiptDirectory({ receiptId: receipt.id, storedPath: receipt.storedPath });
    } catch {
      failedReceiptIds.push(receipt.id);
      logger.error("receipt.storage.cleanup_failed", {
        operation,
        receiptId: receipt.id
      });
    }
  }
  return { failedReceiptIds };
}

export async function withStoredReceiptCompensation<T>(
  receipt: StoredReceiptReference,
  operation: () => Promise<T>
) {
  try {
    return await operation();
  } catch (error) {
    await cleanupStoredReceipts([receipt], "upload.compensation");
    throw error;
  }
}
