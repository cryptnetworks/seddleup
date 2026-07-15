import path from "node:path";
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupStoredReceipts, withStoredReceiptCompensation } from "@/lib/receipts/cleanup";
import {
  deleteReceiptDirectory,
  receiptDirectoryInsideUploadDir,
  resolveReceiptPathInsideUploadDir,
  validateReceiptFile
} from "@/lib/receipts/storage";

const originalEnv = { ...process.env };
const temporaryDirectories: string[] = [];

async function temporaryUploadDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "seddleup-receipts-"));
  temporaryDirectories.push(directory);
  setRequiredConfig(directory);
  return directory;
}

function setRequiredConfig(uploadDir: string) {
  process.env["DATABASE_URL"] = "file:./test.db";
  process.env["NEXTAUTH_URL"] = "http://localhost:3000";
  process.env["TOKEN_DIGEST_SECRET"] = "test-token-digest-secret-with-length";
  process.env["RECEIPT_UPLOAD_DIR"] = uploadDir;
}

describe("receipt storage paths", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it("allows paths inside the configured upload directory", () => {
    const uploadDir = path.resolve("/tmp/triptally-receipts");
    setRequiredConfig(uploadDir);

    expect(
      resolveReceiptPathInsideUploadDir(path.join(uploadDir, "trip", "receipt", "original.pdf"))
    ).toBe(path.join(uploadDir, "trip", "receipt", "original.pdf"));
  });

  it("accepts receipt content only when its signature matches the declared type", async () => {
    await temporaryUploadDirectory();
    const pdf = new File([Buffer.from("%PDF-1.4\nfixture")], "receipt.pdf", {
      type: "application/pdf"
    });
    const disguised = new File([Buffer.from("<html>not a receipt</html>")], "receipt.pdf", {
      type: "application/pdf"
    });
    const mismatched = new File(
      [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "receipt.jpg",
      { type: "image/jpeg" }
    );

    await expect(validateReceiptFile(pdf)).resolves.toMatchObject({
      ok: true,
      extension: "pdf",
      mimeType: "application/pdf"
    });
    await expect(validateReceiptFile(disguised)).resolves.toEqual({
      ok: false,
      error: "signature"
    });
    await expect(validateReceiptFile(mismatched)).resolves.toEqual({
      ok: false,
      error: "signature"
    });
  });

  it("rejects paths outside the configured upload directory", () => {
    const uploadDir = path.resolve("/tmp/triptally-receipts");
    setRequiredConfig(uploadDir);

    expect(() =>
      resolveReceiptPathInsideUploadDir("/tmp/triptally-receipts-evil/file.pdf")
    ).toThrow("escaped upload directory");
  });

  it("requires the stored file to belong to the exact receipt directory", () => {
    const uploadDir = path.resolve("/tmp/triptally-receipts");
    setRequiredConfig(uploadDir);

    expect(() =>
      receiptDirectoryInsideUploadDir(
        "receipt-1",
        path.join(uploadDir, "different-receipt", "original.pdf")
      )
    ).toThrow("did not match");
    expect(() =>
      receiptDirectoryInsideUploadDir("../escape", path.join(uploadDir, "escape", "original.pdf"))
    ).toThrow("Invalid receipt storage identifier");
  });

  it("deletes only the expected receipt directory and is idempotent", async () => {
    const uploadDir = await temporaryUploadDirectory();
    const receiptDir = path.join(uploadDir, "receipt-1");
    const siblingDir = path.join(uploadDir, "receipt-2");
    const storedPath = path.join(receiptDir, "original.pdf");
    await mkdir(receiptDir);
    await mkdir(siblingDir);
    await writeFile(storedPath, "private fixture");
    await writeFile(path.join(siblingDir, "original.pdf"), "keep fixture");

    await expect(deleteReceiptDirectory({ receiptId: "receipt-1", storedPath })).resolves.toBe(
      true
    );
    await expect(access(receiptDir)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(siblingDir, "original.pdf"))).resolves.toBeUndefined();
    await expect(deleteReceiptDirectory({ receiptId: "receipt-1", storedPath })).resolves.toBe(
      false
    );
  });

  it("never follows a receipt-directory symlink", async () => {
    const uploadDir = await temporaryUploadDirectory();
    const outsideDir = await mkdtemp(path.join(tmpdir(), "seddleup-receipts-outside-"));
    temporaryDirectories.push(outsideDir);
    await writeFile(path.join(outsideDir, "private.pdf"), "keep fixture");
    await symlink(outsideDir, path.join(uploadDir, "receipt-link"));

    await expect(
      deleteReceiptDirectory({
        receiptId: "receipt-link",
        storedPath: path.join(uploadDir, "receipt-link", "private.pdf")
      })
    ).rejects.toThrow("not an expected directory");
    await expect(access(path.join(outsideDir, "private.pdf"))).resolves.toBeUndefined();
  });

  it("compensates a failed upload after storage succeeds", async () => {
    const uploadDir = await temporaryUploadDirectory();
    const receiptDir = path.join(uploadDir, "receipt-failed");
    const storedPath = path.join(receiptDir, "original.pdf");
    await mkdir(receiptDir);
    await writeFile(storedPath, "private fixture");

    await expect(
      withStoredReceiptCompensation({ id: "receipt-failed", storedPath }, async () => {
        throw new Error("parser fixture failure");
      })
    ).rejects.toThrow("parser fixture failure");
    await expect(access(receiptDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("logs cleanup failures without the private path", async () => {
    const uploadDir = await temporaryUploadDirectory();
    const privatePath = path.join(uploadDir, "different", "private-name.pdf");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await cleanupStoredReceipts(
      [{ id: "receipt-1", storedPath: privatePath }],
      "receipt.delete"
    );

    expect(result.failedReceiptIds).toEqual(["receipt-1"]);
    const line = String(errorLog.mock.calls[0]?.[0]);
    expect(line).toContain("receipt.storage.cleanup_failed");
    expect(line).toContain("receipt-1");
    expect(line).not.toContain(privatePath);
    expect(line).not.toContain("private-name.pdf");
  });
});
