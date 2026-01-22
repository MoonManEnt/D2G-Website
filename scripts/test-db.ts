import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import path from "path";

// Load .env explicitly
dotenv.config();

const prisma = new PrismaClient({
    log: ["query", "error", "warn"],
});

async function main() {
    console.log("--- Environment Debug ---");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    console.log("CWD:", process.cwd());

    try {
        console.log("\n--- Testing Database Connection ---");
        const userCount = await prisma.user.count();
        console.log("Total users in DB:", userCount);

        const admin = await prisma.user.findUnique({
            where: { email: "admin@dispute2go.demo" },
            include: { organization: true }
        });

        if (admin) {
            console.log("✅ Admin user found.");
            console.log("Organization:", admin.organization.name);
        } else {
            console.log("❌ Admin user NOT found.");
        }
    } catch (err) {
        console.error("❌ Database test failed!");
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
