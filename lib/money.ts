export const USD_MAX_CENTS = 100_000_000;

export type UsdMoney = {
  cents: number;
  decimal: string;
};

export type UsdMoneyError = "required" | "format" | "positive" | "precision" | "maximum";

export type ParseUsdMoneyResult =
  { ok: true; value: UsdMoney } | { ok: false; error: UsdMoneyError; message: string };

function invalid(error: UsdMoneyError, message: string): ParseUsdMoneyResult {
  return { ok: false, error, message };
}

export function usdDecimalFromCents(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("USD cents must be a non-negative safe integer.");
  }
  const dollars = Math.floor(cents / 100);
  return `${dollars}.${String(cents % 100).padStart(2, "0")}`;
}

export function parseUsdMoney(
  input: unknown,
  options: { allowZero?: boolean; maximumCents?: number } = {}
): ParseUsdMoneyResult {
  if (typeof input !== "string") {
    return invalid("format", "Enter a valid USD amount.");
  }

  const value = input.trim();
  if (!value) return invalid("required", "Enter an amount.");
  if (/e/i.test(value)) {
    return invalid("format", "Use ordinary decimal notation, not exponent notation.");
  }
  if (/^-/.test(value)) {
    return invalid("positive", "Amount cannot be negative.");
  }
  if (!/^\d+(?:[.,]\d+)?$/.test(value)) {
    return invalid("format", "Enter digits with one optional decimal separator.");
  }

  const separatorIndex = Math.max(value.indexOf("."), value.indexOf(","));
  const whole = separatorIndex === -1 ? value : value.slice(0, separatorIndex);
  const fraction = separatorIndex === -1 ? "" : value.slice(separatorIndex + 1);
  if (fraction.length > 2) {
    return invalid("precision", "USD amounts support no more than two decimal places.");
  }

  let cents: bigint;
  try {
    cents = BigInt(whole) * BigInt(100) + BigInt((fraction || "0").padEnd(2, "0"));
  } catch {
    return invalid("format", "Enter a valid USD amount.");
  }

  const maximumCents = options.maximumCents ?? USD_MAX_CENTS;
  if (cents > BigInt(maximumCents)) {
    return invalid("maximum", `Amount cannot exceed $${usdDecimalFromCents(maximumCents)}.`);
  }
  if (!options.allowZero && cents === BigInt(0)) {
    return invalid("positive", "Amount must be greater than zero.");
  }

  const centsNumber = Number(cents);
  return {
    ok: true,
    value: {
      cents: centsNumber,
      decimal: usdDecimalFromCents(centsNumber)
    }
  };
}

export function equalShareCents(totalCents: number, participantCount: number) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error("Total cents must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(participantCount) || participantCount <= 0) return [];

  const base = Math.floor(totalCents / participantCount);
  const remainder = totalCents % participantCount;
  return Array.from({ length: participantCount }, (_, index) => base + (index < remainder ? 1 : 0));
}
