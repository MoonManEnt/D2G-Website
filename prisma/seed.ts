import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create organization
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-001" },
    update: {},
    create: {
      id: "demo-org-001",
      name: "Demo Credit Repair",
      slug: "demo-credit-repair",
      subscriptionTier: "PROFESSIONAL" as string,
      settings: JSON.stringify({
        defaultFlow: "METRO2",
        autoGenerateLetters: true,
      }),
    },
  });
  console.log("Created organization:", org.name);

  // Create demo user
  const hashedPassword = await bcrypt.hash("Demo1234!", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@dispute2go.demo" },
    update: {},
    create: {
      email: "admin@dispute2go.demo",
      name: "Demo Admin",
      passwordHash: hashedPassword,
      role: "OWNER" as string,
      organizationId: org.id,
    },
  });
  console.log("Created user:", user.email);

  // Create demo clients
  const clients = [
    {
      id: "client-001",
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@example.com",
      phone: "+1234567890",
      addressLine1: "123 Main Street",
      city: "Los Angeles",
      state: "CA",
      zipCode: "90001",
      ssnLast4: "1234",
    },
    {
      id: "client-002",
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.j@example.com",
      phone: "+1234567891",
      addressLine1: "456 Oak Avenue",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      ssnLast4: "5678",
    },
    {
      id: "client-003",
      firstName: "Michael",
      lastName: "Davis",
      email: "m.davis@example.com",
      phone: "+1234567892",
      addressLine1: "789 Pine Road",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      ssnLast4: "9012",
    },
  ];

  for (const clientData of clients) {
    const client = await prisma.client.upsert({
      where: { id: clientData.id },
      update: {},
      create: {
        ...clientData,
        organizationId: org.id,
        isActive: true,
      },
    });
    console.log("Created client:", client.firstName, client.lastName);

    // Add credit scores
    const cras = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];
    for (const cra of cras) {
      await prisma.creditScore.upsert({
        where: { id: `${client.id}-${cra}-score` },
        update: {},
        create: {
          id: `${client.id}-${cra}-score`,
          clientId: client.id,
          cra,
          score: Math.floor(Math.random() * 200) + 500,
          scoreDate: new Date(),
          source: "MANUAL",
        },
      });
    }
  }

  // Create sample dispute
  await prisma.dispute.upsert({
    where: { id: "dispute-001" },
    update: {},
    create: {
      id: "dispute-001",
      clientId: "client-001",
      organizationId: org.id,
      flow: "METRO2" as string,
      round: 1,
      cra: "TRANSUNION" as string,
      status: "DRAFT" as string,
      letterContent: "Sample dispute letter content...",
    },
  });
  console.log("Created sample dispute");

  console.log("\n✅ Database seeded!");
  console.log("\nDemo credentials:");
  console.log("  Email: admin@dispute2go.demo");
  console.log("  Password: Demo1234!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
