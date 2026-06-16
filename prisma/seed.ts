import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { calculateEqualShares } from "../lib/calculations";
import { createPrismaAdapter } from "../lib/prisma-adapter";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: { email: "demo@seddleup.app" }
  });

  if (existingUser) {
    console.log("Demo user already exists. Skipping seed.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      username: "demo",
      email: "demo@seddleup.app",
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash("DemoPass123", 12),
      trips: {
        create: {
          name: "Coastal Weekend",
          destination: "Monterey Bay",
          startDate: new Date("2025-09-05T00:00:00"),
          endDate: new Date("2025-09-08T00:00:00")
        }
      }
    },
    include: { trips: true }
  });

  const trip = user.trips[0];
  const participants = await Promise.all([
    prisma.participant.create({
      data: { name: "Alice", email: "alice@example.com", tripId: trip.id }
    }),
    prisma.participant.create({
      data: { name: "Bob", email: "bob@example.com", tripId: trip.id }
    }),
    prisma.participant.create({
      data: { name: "Claire", email: "claire@example.com", tripId: trip.id }
    })
  ]);

  const expenses = [
    {
      title: "Rental Car",
      amount: 360,
      category: "Transportation",
      payerId: participants[0].id,
      date: new Date("2025-09-05T00:00:00"),
      notes: "Compact SUV for the weekend"
    },
    {
      title: "Dinner",
      amount: 142.25,
      category: "Food",
      payerId: participants[1].id,
      date: new Date("2025-09-06T00:00:00"),
      notes: "Seafood dinner at the wharf"
    },
    {
      title: "Groceries",
      amount: 78.92,
      category: "Supplies",
      payerId: participants[2].id,
      date: new Date("2025-09-06T00:00:00"),
      notes: "Breakfast and snack items"
    }
  ];

  for (const expense of expenses) {
    const shares = calculateEqualShares(expense.amount, participants.length);
    await prisma.expense.create({
      data: {
        ...expense,
        tripId: trip.id,
        shares: {
          create: participants.map((participant, index) => ({
            participantId: participant.id,
            shareAmount: shares[index]
          }))
        }
      }
    });
  }

  console.log("Seeded demo data.");
  console.log("Email: demo@seddleup.app");
  console.log("Password: DemoPass123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
