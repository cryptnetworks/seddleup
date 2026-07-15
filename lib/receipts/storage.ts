import path from "node:path";
import { lstat, mkdir, rm, writeFile } from "node:fs/promises";
import { getAppConfig } from "@/lib/config";

export const allowedReceiptMimeTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/heic", "heic"],
  ["image/heif", "heic"]
]);

export function receiptUploadConfig() {
  const config = getAppConfig();
  return {
    uploadDir: path.resolve(config.receiptUploadDir),
    maxBytes: Math.round(config.maxReceiptUploadMb * 1024 * 1024)
  };
}

export function validateReceiptFile(file: File) {
  const config = receiptUploadConfig();
  if (file.size <= 0) return { ok: false as const, error: "empty" };
  if (file.size > config.maxBytes) return { ok: false as const, error: "too_large" };
  const extension = allowedReceiptMimeTypes.get(file.type);
  if (!extension) return { ok: false as const, error: "type" };
  return { ok: true as const, extension };
}

export function safeOriginalFilename(name: string) {
  const basename = path
    .basename(name)
    .replaceAll(/[^\w.\- ]/g, "_")
    .trim();
  return basename || "receipt";
}

export function resolveReceiptPathInsideUploadDir(storedPath: string) {
  const config = receiptUploadConfig();
  const uploadDir = path.resolve(config.uploadDir);
  const resolvedPath = path.resolve(storedPath);
  const relativePath = path.relative(uploadDir, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Resolved receipt path escaped upload directory.");
  }
  return resolvedPath;
}

export function receiptDirectoryInsideUploadDir(receiptId: string, storedPath: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(receiptId)) {
    throw new Error("Invalid receipt storage identifier.");
  }

  const config = receiptUploadConfig();
  const receiptDirectory = resolveReceiptPathInsideUploadDir(
    path.join(config.uploadDir, receiptId)
  );
  const resolvedStoredPath = resolveReceiptPathInsideUploadDir(storedPath);
  if (path.dirname(resolvedStoredPath) !== receiptDirectory) {
    throw new Error("Stored receipt path did not match the expected receipt directory.");
  }
  return receiptDirectory;
}

export async function deleteReceiptDirectory({
  receiptId,
  storedPath
}: {
  receiptId: string;
  storedPath: string;
}) {
  const receiptDirectory = receiptDirectoryInsideUploadDir(receiptId, storedPath);
  let directoryStat;
  try {
    directoryStat = await lstat(receiptDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }

  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new Error("Receipt storage target was not an expected directory.");
  }

  await rm(receiptDirectory, { recursive: true, force: true, maxRetries: 2 });
  return true;
}

export async function storeReceiptFile({
  receiptId,
  file,
  extension
}: {
  receiptId: string;
  file: File;
  extension: string;
}) {
  const config = receiptUploadConfig();
  const storedFilename = `original.${extension}`;
  const storedPath = resolveReceiptPathInsideUploadDir(
    path.join(config.uploadDir, receiptId, storedFilename)
  );

  await mkdir(path.dirname(storedPath), { recursive: true });
  await writeFile(storedPath, Buffer.from(await file.arrayBuffer()));
  return { storedFilename, storedPath };
}
