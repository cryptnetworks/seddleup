import { NextResponse } from "next/server";
import { calculateBalances } from "@/lib/calculations";
import { getAppConfig } from "@/lib/config";
import { createDiscordLinkToken } from "@/lib/discord/linking";
import { verifyDiscordRequest } from "@/lib/discord/security";
import { prisma } from "@/lib/prisma";

const ephemeral = 1 << 6;

type DiscordOption = {
  name: string;
  type: number;
  value?: string | number;
  options?: DiscordOption[];
};

function reply(content: string) {
  return NextResponse.json({ type: 4, data: { content, flags: ephemeral } });
}

function option(options: DiscordOption[] | undefined, name: string) {
  return options?.find((item) => item.name === name);
}

async function linkedUser(discordUserId: string) {
  return prisma.discordAccount.findUnique({
    where: { discordUserId },
    include: { user: true }
  });
}

export async function POST(request: Request) {
  const config = getAppConfig();
  if (!config.discordEnabled) {
    return NextResponse.json({ error: "Discord integration is disabled" }, { status: 404 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!verifyDiscordRequest({ body, signature, timestamp, publicKey: config.discordPublicKey })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(body);
  if (interaction.type === 1) return NextResponse.json({ type: 1 });

  const discordUser = interaction.member?.user || interaction.user;
  const discordUserId = discordUser?.id;
  const command = interaction.data?.name;
  const options = interaction.data?.options as DiscordOption[] | undefined;
  if (!discordUserId || !command) return reply("Unsupported Discord interaction.");

  const account = await linkedUser(discordUserId);
  if (account?.user.disabledAt) {
    return reply("This SeddleUp account is unavailable.");
  }

  if (command === "link") {
    if (account) return reply("This Discord account is already linked.");
    const url = await createDiscordLinkToken({
      discordUserId,
      discordUsername: discordUser?.username,
      request
    });
    return reply(`Open this private link while signed in to SeddleUp: ${url}`);
  }

  if (!account) return reply("Link your account first with `/link`.");

  if (command === "trip") {
    const subcommand = options?.[0];
    if (subcommand?.name === "list") {
      const trips = await prisma.trip.findMany({
        where: { members: { some: { userId: account.userId } } },
        orderBy: { updatedAt: "desc" },
        take: 10
      });
      return reply(
        trips.length ? trips.map((trip) => `- ${trip.name}`).join("\n") : "No linked trips yet."
      );
    }

    if (subcommand?.name === "create") {
      const name = String(option(subcommand.options, "name")?.value || "").trim();
      if (!name) return reply("Trip name is required.");
      const trip = await prisma.trip.create({
        data: {
          name,
          destination: String(option(subcommand.options, "description")?.value || "") || null,
          ownerId: account.userId,
          members: { create: { userId: account.userId, role: "owner" } }
        }
      });
      return reply(`Created trip: ${trip.name}`);
    }

    if (subcommand?.name === "summary") {
      const tripName = String(option(subcommand.options, "trip")?.value || "").trim();
      const trip = await prisma.trip.findFirst({
        where: { name: tripName, members: { some: { userId: account.userId } } },
        include: {
          participants: true,
          expenses: { where: { status: { not: "draft" } }, include: { shares: true } }
        }
      });
      if (!trip) return reply("Trip not found or not linked to your account.");
      const total = trip.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      const { settlements } = calculateBalances(trip.participants, trip.expenses);
      return reply(
        `${trip.name}: $${total.toFixed(2)} across ${trip.participants.length} member(s).\n${
          settlements
            .slice(0, 5)
            .map((settlement) => settlement.label)
            .join("\n") || "No settlements needed."
        }`
      );
    }
  }

  return reply("Command is not implemented yet.");
}
