import { PrismaClient } from "@prisma/client";
import { generateCRALetter } from "../src/lib/document-generator";
import { CRA, FlowType } from "../src/types";

const prisma = new PrismaClient();

async function vibeCheck() {
    console.log("🚀 Starting Dispute2Go Vibe Check...");

    try {
        // 1. Check Database Connection
        console.log("Checking database connection...");
        const orgCount = await prisma.organization.count();
        console.log(`✅ Database connected. Found ${orgCount} organizations.`);

        // 2. Resolve Statutes
        console.log("Testing statute resolution...");
        const testStatute = await prisma.statuteContent.findFirst({
            where: { flow: "ACCURACY", round: 1 }
        });
        if (testStatute) {
            console.log(`✅ Statute resolution working. Resolved: ${testStatute.statuteCode}`);
        } else {
            console.warn("⚠️ No statutes found in DB. Make sure you've run the seed script.");
        }

        // 3. Test Document Generation Logic
        console.log("Testing document generation logic (CRA Letter)...");
        const demoContext = {
            client: {
                firstName: "John",
                lastName: "Doe",
                addressLine1: "123 Main St",
                city: "Anytown",
                state: "USA",
                zipCode: "12345",
                ssnLast4: "1234"
            },
            cra: CRA.EQUIFAX,
            accounts: [
                {
                    creditorName: "Sample Bank",
                    maskedAccountId: "4567****",
                    disputeReason: "Late payment incorrectly reported."
                }
            ],
            flow: FlowType.ACCURACY,
            round: 1
        };

        const letter = await generateCRALetter(demoContext);
        if (letter && letter.fullContent) {
            console.log("✅ Document generation logic working.");
            console.log(`Preview: ${letter.fullContent.slice(0, 100)}...`);
        } else {
            throw new Error("Document generation returned empty content.");
        }

        // 4. Check Environment Variables
        console.log("Checking critical environment variables...");
        const requiredEnv = [
            "RESEND_API_KEY",
            "STRIPE_SECRET_KEY",
            "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_PRO_PRICE"
        ];

        let missingEnv = false;
        for (const env of requiredEnv) {
            if (!process.env[env]) {
                console.warn(`⚠️ Missing environment variable: ${env}`);
                missingEnv = true;
            }
        }

        if (!missingEnv) {
            console.log("✅ All critical production environment variables detected.");
        }

        console.log("\n✨ Vibe Check Complete! Dispute2Go is structurally sound.");
    } catch (error) {
        console.error("\n❌ Vibe Check Failed!");
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

vibeCheck();
