import crypto from "node:crypto";
import type { TripShareLink } from "@prisma/client";
import { calculateBalances, roundCurrency } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { digestLookupToken, timingSafeEqualTokenDigest } from "@/lib/token-digest";
import { canIncludeExpenseInBalances } from "@/lib/trip-permissions";

export const tripShareNameModes = ["anonymized", "initials", "first_name", "full_name"] as const;
export type TripShareNameMode = (typeof tripShareNameModes)[number];

export const tripShareExpiryOptions = ["7", "30", "90", "never"] as const;
export type TripShareExpiryOption = (typeof tripShareExpiryOptions)[number];

export const DEFAULT_TRIP_SHARE_NAME_MODE: TripShareNameMode = "anonymized";
export const DEFAULT_TRIP_SHARE_EXPIRY: TripShareExpiryOption = "30";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ANONYMOUS_LOOKUP_LIMIT = 60;
const ANONYMOUS_LOOKUP_WINDOW_MS = 60_000;

export type TripShareStatus = "active" | "expired" | "revoked";

export function generateTripShareToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashTripShareToken(token: string) {
  return digestLookupToken(token);
}

export function isValidTripShareTokenShape(token: string) {
  return TOKEN_PATTERN.test(token);
}

export function tripShareExpiresAt(option: TripShareExpiryOption, now = new Date()) {
  if (option === "never") return null;
  return new Date(now.getTime() + Number(option) * 24 * 60 * 60 * 1000);
}

export function tripShareStatus(
  link: Pick<TripShareLink, "expiresAt" | "revokedAt">,
  now = new Date()
): TripShareStatus {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

export function checkTripShareLookupRateLimit(requestKey: string) {
  return checkRateLimit(`trip-share-view:${requestKey}`, {
    limit: ANONYMOUS_LOOKUP_LIMIT,
    windowMs: ANONYMOUS_LOOKUP_WINDOW_MS
  });
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Traveler";
}

function initials(name: string) {
  const value = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return value || "T";
}

export function participantShareLabels(
  participants: { id: string; name: string }[],
  mode: TripShareNameMode
) {
  return new Map(
    participants.map((participant, index) => {
      let label = `Traveler ${index + 1}`;
      if (mode === "full_name") label = participant.name;
      if (mode === "first_name") label = firstName(participant.name);
      if (mode === "initials") label = initials(participant.name);
      return [participant.id, label] as const;
    })
  );
}

export async function resolveTripShareSummary(token: string, now = new Date()) {
  if (!isValidTripShareTokenShape(token)) return null;

  const tokenHash = hashTripShareToken(token);
  const link = await prisma.tripShareLink.findUnique({
    where: { tokenHash },
    select: {
      tokenHash: true,
      participantNameMode: true,
      expiresAt: true,
      revokedAt: true,
      trip: {
        select: {
          name: true,
          startDate: true,
          endDate: true,
          participants: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true }
          },
          expenses: {
            where: { status: { not: "draft" } },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            select: {
              title: true,
              amount: true,
              category: true,
              date: true,
              status: true,
              payerId: true,
              shares: { select: { participantId: true, shareAmount: true } }
            }
          }
        }
      }
    }
  });

  if (!link || !timingSafeEqualTokenDigest(token, link.tokenHash)) return null;
  if (tripShareStatus(link, now) !== "active") return null;

  const nameMode = tripShareNameModes.includes(link.participantNameMode as TripShareNameMode)
    ? (link.participantNameMode as TripShareNameMode)
    : DEFAULT_TRIP_SHARE_NAME_MODE;
  const labels = participantShareLabels(link.trip.participants, nameMode);
  const participants = link.trip.participants.map((participant) => ({
    id: participant.id,
    name: labels.get(participant.id) || "Traveler"
  }));
  const includedExpenses = link.trip.expenses.filter((expense) =>
    canIncludeExpenseInBalances(expense.status)
  );
  const { balances, settlements } = calculateBalances(participants, includedExpenses);

  return {
    trip: {
      name: link.trip.name,
      startDate: link.trip.startDate,
      endDate: link.trip.endDate,
      currency: "USD"
    },
    totalCost: roundCurrency(
      includedExpenses.reduce((total, expense) => total + Number(expense.amount), 0)
    ),
    expenses: includedExpenses.map((expense) => ({
      title: expense.title,
      amount: Number(expense.amount),
      category: expense.category,
      date: expense.date,
      status: expense.status,
      payerName: labels.get(expense.payerId) || "Traveler"
    })),
    balances: balances.map((balance) => ({
      participantName: balance.participant.name,
      paid: balance.paid,
      owed: balance.owed,
      net: balance.net
    })),
    settlements: settlements.map((settlement) => ({
      debtorName: settlement.debtorName,
      creditorName: settlement.creditorName,
      amount: settlement.amount
    }))
  };
}
