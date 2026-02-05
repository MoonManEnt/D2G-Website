/**
 * One-time migration script to update "PRO" tier to "PROFESSIONAL"
 * Run: npx tsx scripts/migrate-pro-to-professional.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting PRO → PROFESSIONAL migration...");

  const proOrgs = await prisma.organization.findMany({
    where: { subscriptionTier: "PRO" },
    select: { id: true, name: true, stripeSubscriptionId: true },
  });

  console.log(`Found ${proOrgs.length} organizations with PRO tier`);

  for (const org of proOrgs) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { subscriptionTier: "PROFESSIONAL" },
    });
    console.log(`  Updated: ${org.name} (${org.id})`);
  }

  console.log("Migration complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
