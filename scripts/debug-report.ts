
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const reportId = "fcf18038-0a3d-431a-91fb-70d37fb31522"; // ID from screenshot
    const report = await prisma.creditReport.findUnique({
        where: { id: reportId },
        include: { originalFile: true }
    });

    if (report) {
        console.log("Report found:");
        console.log("ID:", report.id);
        console.log("Original File:", report.originalFile);
        console.log("Storage Path:", report.originalFile?.storagePath);
    } else {
        console.log("Report not found");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
