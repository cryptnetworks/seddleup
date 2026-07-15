import { formatCurrency } from "@/lib/format";

export type TripActivityEntry = {
  id: string;
  action: string;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: Date;
  actor: {
    username: string;
    email: string;
  } | null;
};

export type TripActivityKind = "trip" | "add" | "edit" | "remove" | "receipt" | "share";

type ActivityDescription = {
  summary: string;
  detail?: string;
  kind: TripActivityKind;
};

function parseSnapshot(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function snapshotString(snapshot: Record<string, unknown> | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function snapshotNumber(snapshot: Record<string, unknown> | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function quoted(value: string | null, fallback: string) {
  return `“${value || fallback}”`;
}

function readableLabel(value: string | null) {
  if (!value) return null;
  const words = value.replaceAll(/[._-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function expenseDetail(snapshot: Record<string, unknown> | null) {
  const amount = snapshotNumber(snapshot, "amount");
  const category = snapshotString(snapshot, "category");
  const status = readableLabel(snapshotString(snapshot, "status"));
  const parts = [amount === null ? null : formatCurrency(amount), category, status].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

function humanizeUnknownAction(action: string) {
  const words = action.replaceAll(/[._-]+/g, " ").trim();
  return words || "an activity update";
}

export function describeTripActivity(entry: TripActivityEntry): ActivityDescription {
  const actor = entry.actor?.username || entry.actor?.email || "SeddleUp";
  const before = parseSnapshot(entry.beforeJson);
  const after = parseSnapshot(entry.afterJson);

  switch (entry.action) {
    case "trip.create":
      return { summary: `${actor} created this trip`, kind: "trip" };
    case "trip.update":
      return { summary: `${actor} updated the trip details`, kind: "edit" };
    case "participant.create":
      return {
        summary: `${actor} added traveler ${quoted(snapshotString(after, "name"), "Unnamed traveler")}`,
        kind: "add"
      };
    case "participant.update":
      return {
        summary: `${actor} updated traveler ${quoted(snapshotString(after, "name"), "Unnamed traveler")}`,
        kind: "edit"
      };
    case "participant.delete":
      return {
        summary: `${actor} removed traveler ${quoted(snapshotString(before, "name"), "Unnamed traveler")}`,
        kind: "remove"
      };
    case "expense.create":
      return {
        summary: `${actor} added the expense ${quoted(snapshotString(after, "title"), "Untitled expense")}`,
        detail: expenseDetail(after),
        kind: "add"
      };
    case "expense.update":
      return {
        summary: `${actor} updated the expense ${quoted(snapshotString(after, "title"), "Untitled expense")}`,
        detail: expenseDetail(after),
        kind: "edit"
      };
    case "expense.delete":
      return {
        summary: `${actor} deleted the expense ${quoted(snapshotString(before, "title"), "Untitled expense")}`,
        detail: expenseDetail(before),
        kind: "remove"
      };
    case "receipt.upload":
      return {
        summary: `${actor} uploaded a receipt`,
        detail: snapshotString(after, "originalFilename") || undefined,
        kind: "receipt"
      };
    case "receipt.review":
      return {
        summary: `${actor} reviewed a receipt`,
        detail: readableLabel(snapshotString(after, "status")) || undefined,
        kind: "receipt"
      };
    case "trip_share.create":
      return { summary: `${actor} created a read-only sharing link`, kind: "share" };
    case "trip_share.rotate":
      return { summary: `${actor} replaced the read-only sharing link`, kind: "share" };
    case "trip_share.settings_update":
      return { summary: `${actor} updated the sharing settings`, kind: "share" };
    case "trip_share.revoke":
      return { summary: `${actor} turned off the sharing link`, kind: "remove" };
    default:
      return {
        summary: `${actor} recorded ${humanizeUnknownAction(entry.action)}`,
        kind: "trip"
      };
  }
}

export function formatTripActivityTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}
