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
      flow: "ACCURACY",
      round: 1,
      cra: "TRANSUNION",
      status: "DRAFT",
      letterContent: "Sample dispute letter content...",
    },
  });
  console.log("Created sample dispute");

  // ===========================================================================
  // SEED STATUTES
  // ===========================================================================
  console.log("\nSeeding statutes...");
  const statutes = [
    // ACCURACY FLOW
    { flow: "ACCURACY", round: 1, statuteCode: "FACTUAL", shortTitle: "Factual Inaccuracy", fullText: "The reported information is factually incorrect and must be corrected.", argumentText: "The information being reported is factually inaccurate. I am disputing this information on the basis of verifiable factual errors." },
    { flow: "ACCURACY", round: 2, statuteCode: "1681e(b)", shortTitle: "Maximum Possible Accuracy", fullText: "Consumer reporting agencies must follow reasonable procedures to assure maximum possible accuracy.", argumentText: "Under 15 U.S.C. § 1681e(b), you must follow reasonable procedures to assure maximum possible accuracy. The inaccurate information fails to meet this standard." },
    { flow: "ACCURACY", round: 3, statuteCode: "1681i(a)(5)", shortTitle: "Reinvestigation Results", fullText: "CRA must provide written results of reinvestigation within 5 days.", argumentText: "Under 15 U.S.C. § 1681i(a)(5), you are required to provide written results of any reinvestigation within five business days of completion." },
    { flow: "ACCURACY", round: 4, statuteCode: "1681i(a)(1)(A)", shortTitle: "Reinvestigation Requirement", fullText: "CRA must conduct a reasonable reinvestigation.", argumentText: "Under 15 U.S.C. § 1681i(a)(1)(A), you must conduct a reasonable reinvestigation to determine whether the disputed information is inaccurate." },
    { flow: "ACCURACY", round: 5, statuteCode: "1681i(a)(7)", shortTitle: "Description of Process", fullText: "CRA must provide description of reinvestigation procedure.", argumentText: "Under 15 U.S.C. § 1681i(a)(7), you are required to provide a description of the procedure used to determine accuracy, including furnisher contact info." },

    // COLLECTION FLOW
    { flow: "COLLECTION", round: 1, statuteCode: "1692g", shortTitle: "Validation of Debts", fullText: "Debt collector must send validation notice within 5 days.", argumentText: "Under 15 U.S.C. § 1692g, a debt collector must send a written notice containing validation rights within five days of initial communication." },
    { flow: "COLLECTION", round: 2, statuteCode: "1692g(b)", shortTitle: "Debt Validation Request", fullText: "Collection must cease until verification is provided.", argumentText: "Under 15 U.S.C. § 1692g(b), collection of the debt must cease until verification is provided to the consumer." },

    // MEDICAL & SPECIALIZED
    { flow: "COLLECTION", round: 4, statuteCode: "1681a(m)", shortTitle: "Medical Debt", fullText: "Restrictions on medical debt reporting.", argumentText: "Under 15 U.S.C. § 1681a(m), there are specific restrictions on how medical debt should be reported and verified. This item violates those standards." },
  ];

  for (const s of statutes) {
    const existing = await prisma.statuteContent.findFirst({
      where: {
        flow: s.flow,
        round: s.round,
        isSystemDefault: true,
      }
    });

    if (existing) {
      await prisma.statuteContent.update({
        where: { id: existing.id },
        data: s
      });
    } else {
      await prisma.statuteContent.create({
        data: {
          ...s,
          isSystemDefault: true,
        }
      });
    }
  }
  console.log(`Seeded ${statutes.length} statutes`);

  // ===========================================================================
  // SEED TEMPLATES
  // ===========================================================================
  console.log("\nSeeding templates...");
  const templates = [
    {
      name: "Standard Accuracy - Round 1",
      documentType: "CRA_LETTER",
      flow: "ACCURACY",
      round: 1,
      headerTemplate: "Dear Consumer Relations,",
      bodyTemplate: "I am writing to bring your attention to some serious errors on my credit report. It seems that {creditorName} is reporting inaccurate data. I am concerned that this might be a mistake in your system.",
      footerTemplate: "Sincerely, {clientName}",
    },
    {
      name: "Aggressive Accuracy - Round 4",
      documentType: "CRA_LETTER",
      flow: "ACCURACY",
      round: 4,
      headerTemplate: "FINAL NOTICE - LEGAL DEPARTMENT,",
      bodyTemplate: "You have repeatedly failed to conduct a reasonable reinvestigation of the following items: {itemList}. This is a willful violation of my rights under the FCRA. If these items are not deleted within 15 days, I will be forced to escalate this to my legal counsel.",
      footerTemplate: "Govern yourself accordingly, {clientName}",
    }
  ];

  for (const t of templates) {
    await prisma.letterTemplate.create({
      data: {
        ...t,
        isSystemDefault: true,
      }
    });
  }
  console.log(`Seeded ${templates.length} templates`);

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
