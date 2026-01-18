/**
 * Dispute2Go Database Seed Script
 * 
 * Run with: npm run db:seed
 * 
 * Creates demo organization, user, clients, and sample data
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clean existing data (in dev only)
  if (process.env.NODE_ENV !== "production") {
    console.log("Cleaning existing data...");
    await prisma.eventLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.documentEvidence.deleteMany();
    await prisma.document.deleteMany();
    await prisma.disputeItem.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.diffChange.deleteMany();
    await prisma.diffResult.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.accountItem.deleteMany();
    await prisma.creditReport.deleteMany();
    await prisma.storedFile.deleteMany();
    await prisma.client.deleteMany();
    await prisma.letterTemplate.deleteMany();
    await prisma.statuteContent.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  }

  // Create demo organization
  console.log("Creating organization...");
  const org = await prisma.organization.create({
    data: {
      name: "Credit Repair Specialists LLC",
      slug: "credit-repair-specialists",
      subscriptionTier: "PRO",
      subscriptionStatus: "ACTIVE",
      settings: {
        defaultFlow: "ACCURACY",
        autoAssignFlow: false,
        requireApproval: true,
      },
    },
  });
  console.log(`  ✓ Organization: ${org.name}`);

  // Create demo user
  console.log("Creating users...");
  const passwordHash = await hash("Demo1234!", 12);
  
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@dispute2go.demo",
      passwordHash,
      name: "Demo Admin",
      role: "ADMIN",
      organizationId: org.id,
    },
  });
  console.log(`  ✓ Admin: ${adminUser.email} (password: Demo1234!)`);

  const specialistUser = await prisma.user.create({
    data: {
      email: "specialist@dispute2go.demo",
      passwordHash,
      name: "Demo Specialist",
      role: "SPECIALIST",
      organizationId: org.id,
    },
  });
  console.log(`  ✓ Specialist: ${specialistUser.email} (password: Demo1234!)`);

  // Create demo clients
  console.log("Creating clients...");
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@example.com",
        phone: "(555) 123-4567",
        addressLine1: "123 Main Street",
        city: "Austin",
        state: "TX",
        zipCode: "78701",
        ssnLast4: "1234",
        dateOfBirth: new Date("1985-06-15"),
        notes: "Referred by marketing campaign",
        organizationId: org.id,
      },
    }),
    prisma.client.create({
      data: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@example.com",
        phone: "(555) 987-6543",
        addressLine1: "456 Oak Avenue",
        addressLine2: "Apt 2B",
        city: "Dallas",
        state: "TX",
        zipCode: "75201",
        ssnLast4: "5678",
        dateOfBirth: new Date("1990-03-22"),
        organizationId: org.id,
      },
    }),
    prisma.client.create({
      data: {
        firstName: "Michael",
        lastName: "Johnson",
        email: "mike.j@example.com",
        phone: "(555) 456-7890",
        addressLine1: "789 Pine Road",
        city: "Houston",
        state: "TX",
        zipCode: "77001",
        ssnLast4: "9012",
        organizationId: org.id,
      },
    }),
  ]);
  console.log(`  ✓ Created ${clients.length} clients`);

  // Create statute content (system defaults)
  console.log("Creating statute content...");
  const statutes = [
    {
      flow: "ACCURACY",
      round: 1,
      statuteCode: "FACTUAL",
      shortTitle: "Factual Dispute",
      fullText: "Initial factual dispute - no statute citation required.",
      argumentText: "The information being reported is factually inaccurate and cannot be verified.",
      isSystemDefault: true,
    },
    {
      flow: "ACCURACY",
      round: 2,
      statuteCode: "1681e(b)",
      shortTitle: "Maximum Possible Accuracy",
      fullText: "15 U.S.C. § 1681e(b) - Compliance procedures. Whenever a consumer reporting agency prepares a consumer report it shall follow reasonable procedures to assure maximum possible accuracy of the information concerning the individual about whom the report relates.",
      argumentText: "Under 15 U.S.C. § 1681e(b), consumer reporting agencies must follow reasonable procedures to assure maximum possible accuracy. The continued reporting of this inaccurate information demonstrates a failure to follow such procedures.",
      isSystemDefault: true,
    },
    {
      flow: "ACCURACY",
      round: 3,
      statuteCode: "1681i(a)(5)",
      shortTitle: "Reinvestigation Results",
      fullText: "15 U.S.C. § 1681i(a)(5) - Treatment of inaccurate or unverifiable information. If information is found to be inaccurate or incomplete or cannot be verified, the consumer reporting agency shall promptly delete or modify that item.",
      argumentText: "Under 15 U.S.C. § 1681i(a)(5), you are required to provide written results of any reinvestigation within five business days of completion.",
      isSystemDefault: true,
    },
    {
      flow: "COLLECTION",
      round: 1,
      statuteCode: "1692g",
      shortTitle: "Validation Notice",
      fullText: "15 U.S.C. § 1692g - Validation of debts. Within five days after the initial communication with a consumer, a debt collector shall send the consumer a written notice containing the amount of the debt and name of the creditor.",
      argumentText: "Under 15 U.S.C. § 1692g, debt collectors must provide validation notice within five days of initial communication. I am requesting validation of this alleged debt.",
      isSystemDefault: true,
    },
    {
      flow: "COLLECTION",
      round: 2,
      statuteCode: "1692g(b)",
      shortTitle: "Debt Validation Request",
      fullText: "15 U.S.C. § 1692g(b) - Collection activities and communications. If the consumer notifies the debt collector in writing within the thirty-day period that the debt is disputed, the debt collector shall cease collection until verification is obtained.",
      argumentText: "Under 15 U.S.C. § 1692g(b), collection of the debt must cease until verification is provided to the consumer.",
      isSystemDefault: true,
    },
  ];

  for (const statute of statutes) {
    await prisma.statuteContent.create({
      data: {
        ...statute,
        flow: statute.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
        organizationId: null,
      },
    });
  }
  console.log(`  ✓ Created ${statutes.length} statute templates`);

  // Create letter templates
  console.log("Creating letter templates...");
  const templates = [
    {
      name: "CRA Dispute Letter - Standard",
      documentType: "CRA_LETTER",
      headerTemplate: `{{DATE}}

{{CLIENT_NAME}}
{{CLIENT_ADDRESS}}

{{CRA_NAME}}
{{CRA_ADDRESS}}

Re: Dispute of Inaccurate Information
SSN: XXX-XX-{{SSN_LAST4}}`,
      bodyTemplate: `Dear Sir or Madam,

I am writing to dispute inaccurate information appearing on my credit report. Under the Fair Credit Reporting Act, I have the right to dispute any information that I believe is inaccurate.

{{STATUTE_ARGUMENT}}

Please investigate the following account(s):

{{ACCOUNT_LIST}}

{{CONSUMER_STATEMENT}}`,
      footerTemplate: `Respectfully,

{{CLIENT_SIGNATURE}}
{{CLIENT_NAME}}

Enclosures: Copy of identification{{#if HAS_EVIDENCE}}, Supporting evidence{{/if}}`,
      isSystemDefault: true,
      isActive: true,
    },
    {
      name: "CFPB Complaint Draft - Standard",
      documentType: "CFPB_DRAFT",
      headerTemplate: `CFPB COMPLAINT DRAFT
Consumer: {{CLIENT_NAME}}
Against: {{CRA_NAME}}
Date: {{DATE}}`,
      bodyTemplate: `INTRODUCTION
{{CFPB_INTRO}}

WHEN DID THIS HAPPEN?
{{CFPB_WHEN}}

HOW DID THIS AFFECT YOU?
{{CFPB_HOW}}

WHY IS THIS A PROBLEM?
{{CFPB_WHY}}

WHAT DO YOU WANT TO HAPPEN?
{{CFPB_WHAT}}`,
      footerTemplate: `---
This is a draft for CFPB complaint submission. Review and submit at consumerfinance.gov/complaint`,
      isSystemDefault: true,
      isActive: true,
    },
  ];

  for (const template of templates) {
    await prisma.letterTemplate.create({
      data: {
        ...template,
        documentType: template.documentType as "CRA_LETTER" | "CFPB_DRAFT",
        organizationId: null,
      },
    });
  }
  console.log(`  ✓ Created ${templates.length} letter templates`);

  // Log seed event
  await prisma.eventLog.create({
    data: {
      eventType: "USER_CREATED",
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      targetType: "System",
      targetId: "seed",
      eventData: { action: "Database seeded with demo data" },
      organizationId: org.id,
    },
  });

  console.log("\n✅ Seed completed successfully!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Login credentials:");
  console.log("  Email:    admin@dispute2go.demo");
  console.log("  Password: Demo1234!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
