export type ParsedReceiptLineItem = {
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
};

export type ParsedReceipt = {
  provider: string;
  confidence: number;
  rawText: string;
  merchant?: string;
  receiptDate?: Date;
  subtotal?: number;
  tax?: number;
  tip?: number;
  total?: number;
  lineItems: ParsedReceiptLineItem[];
};

export interface ReceiptParser {
  parse(input: { buffer: Buffer; mimeType: string; filename: string }): Promise<ParsedReceipt>;
}

function parseMoney(value?: string | null) {
  if (!value) return undefined;
  const parsed = Number(value.replaceAll(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findAmount(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`\\b${label}\\b\\s*[:\\-]?\\s*\\$?([0-9][0-9,]*\\.[0-9]{2})`, "i");
    const match = text.match(pattern);
    const amount = parseMoney(match?.[1]);
    if (amount !== undefined) return amount;
  }
  return undefined;
}

function findDate(text: string) {
  const match = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  if (!match) return undefined;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function printableText(buffer: Buffer, mimeType: string) {
  if (mimeType.startsWith("image/")) return "";
  return buffer
    .toString("latin1")
    .replaceAll(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replaceAll(/[ \t]{2,}/g, " ")
    .trim();
}

function parseLineItems(text: string) {
  const lines = text
    .split(/\r?\n| {2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const match = line.match(/^(.{2,80}?)\s+\$?([0-9][0-9,]*\.[0-9]{2})$/);
      if (!match) return null;
      const name = match[1].trim();
      if (/subtotal|total|tax|tip|change|cash|card/i.test(name)) return null;
      const totalPrice = parseMoney(match[2]);
      return totalPrice === undefined ? null : { name, quantity: 1, totalPrice };
    })
    .filter((item): item is ParsedReceiptLineItem => Boolean(item))
    .slice(0, 40);
}

export class LocalHeuristicReceiptParser implements ReceiptParser {
  async parse(input: { buffer: Buffer; mimeType: string; filename: string }) {
    const rawText = printableText(input.buffer, input.mimeType);
    const subtotal = findAmount(rawText, ["subtotal", "sub total"]);
    const tax = findAmount(rawText, ["tax", "sales tax"]);
    const tip = findAmount(rawText, ["tip", "gratuity"]);
    const total = findAmount(rawText, ["grand total", "total", "amount due"]);
    const receiptDate = findDate(rawText);
    const firstLine = rawText
      .split(/\r?\n/)
      .find((line) => line.trim().length > 2 && !/^%PDF-|^%%EOF/.test(line.trim()));
    const lineItems = parseLineItems(rawText);
    const matchedFields = [
      subtotal,
      tax,
      tip,
      total,
      receiptDate,
      firstLine,
      lineItems.length ? 1 : undefined
    ].filter((value) => value !== undefined).length;

    return {
      provider: "local-heuristic",
      confidence: Math.min(0.85, matchedFields / 7),
      rawText,
      merchant: firstLine?.slice(0, 120),
      receiptDate,
      subtotal,
      tax,
      tip,
      total,
      lineItems
    };
  }
}

export const defaultReceiptParser = new LocalHeuristicReceiptParser();
