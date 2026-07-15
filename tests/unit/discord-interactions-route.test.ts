import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicKey: "",
  account: vi.fn(),
  tripFindMany: vi.fn(),
  tripFindFirst: vi.fn(),
  tripCreate: vi.fn(),
  createLink: vi.fn()
}));

vi.mock("@/lib/config", () => ({
  getAppConfig: () => ({ discordEnabled: true, discordPublicKey: mocks.publicKey })
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    discordAccount: { findUnique: mocks.account },
    trip: {
      findMany: mocks.tripFindMany,
      findFirst: mocks.tripFindFirst,
      create: mocks.tripCreate
    }
  }
}));
vi.mock("@/lib/discord/linking", () => ({ createDiscordLinkToken: mocks.createLink }));

import { POST } from "@/app/api/discord/interactions/route";

function signedRequest(interaction: Record<string, unknown>) {
  const body = JSON.stringify(interaction);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ format: "der", type: "spki" });
  mocks.publicKey = publicDer.subarray(publicDer.length - 32).toString("hex");
  const signature = crypto.sign(null, Buffer.from(timestamp + body), privateKey).toString("hex");
  return new Request("https://app.example.test/api/discord/interactions", {
    method: "POST",
    headers: {
      "x-signature-ed25519": signature,
      "x-signature-timestamp": timestamp
    },
    body
  });
}

function command(name: "list" | "create" | "summary") {
  const subcommand =
    name === "create"
      ? { name, type: 1, options: [{ name: "name", type: 3, value: "Blocked trip" }] }
      : name === "summary"
        ? { name, type: 1, options: [{ name: "trip", type: 3, value: "Private trip" }] }
        : { name, type: 1 };
  return {
    type: 2,
    member: { user: { id: "discord-disabled", username: "disabled" } },
    data: { name: "trip", options: [subcommand] }
  };
}

describe("Discord interaction account state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const operation of ["list", "create", "summary"] as const) {
    it(`denies a correctly signed ${operation} command from a disabled user`, async () => {
      mocks.account.mockResolvedValue({
        userId: "disabled-user",
        user: { id: "disabled-user", disabledAt: new Date() }
      });

      const response = await POST(signedRequest(command(operation)));
      const payload = (await response.json()) as { data: { content: string } };

      expect(payload.data.content).toBe("This SeddleUp account is unavailable.");
      expect(mocks.tripFindMany).not.toHaveBeenCalled();
      expect(mocks.tripFindFirst).not.toHaveBeenCalled();
      expect(mocks.tripCreate).not.toHaveBeenCalled();
    });
  }

  it("does not dispatch commands for a deleted or unlinked user", async () => {
    mocks.account.mockResolvedValue(null);

    const response = await POST(signedRequest(command("list")));
    const payload = (await response.json()) as { data: { content: string } };

    expect(payload.data.content).toContain("Link your account first");
    expect(mocks.tripFindMany).not.toHaveBeenCalled();
  });
});
