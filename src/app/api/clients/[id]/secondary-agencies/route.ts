import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SECONDARY_AGENCIES, generate1681gLetter } from "@/lib/dispute-templates";
import { generateSimpleLetterPDF, mergePDFs } from "@/lib/pdf-generate";
import { format } from "date-fns";
import { createLogger } from "@/lib/logger";

const log = createLogger("secondary-agency-api");

export const dynamic = "force-dynamic";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        const { id: clientId } = await params;

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await prisma.client.findFirst({
            where: {
                id: clientId,
                organizationId: session.user.organizationId,
            },
        });

        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const currentDate = format(new Date(), "MMMM d, yyyy");
        const letterData = {
            clientName: `${client.firstName} ${client.lastName}`,
            clientAddress: client.addressLine1 || "Address Not Provided",
            clientCity: client.city || "City",
            clientState: client.state || "ST",
            clientZip: client.zipCode || "00000",
            clientSSN4: client.ssnLast4 || "XXXX",
            clientDOB: client.dateOfBirth
                ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
                : "XX/XX/XXXX",
            currentDate,
        };

        const pdfBuffers: Uint8Array[] = [];

        for (const [key, agency] of Object.entries(SECONDARY_AGENCIES)) {
            const letterText = generate1681gLetter(agency, letterData);
            const pdfBytes = await generateSimpleLetterPDF(letterText, {
                title: `1681g Request - ${agency.name}`,
                date: new Date(),
                footer: "Full File Disclosure Request (Phase 1)",
            });
            pdfBuffers.push(pdfBytes);
        }

        const mergedPdf = await mergePDFs(pdfBuffers);
        const filename = `${client.firstName}_${client.lastName}_Secondary_Agencies_1681g.pdf`;

        return new NextResponse(Buffer.from(mergedPdf), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": mergedPdf.length.toString(),
                "Cache-Control": "private, max-age=300",
            },
        });
    } catch (error) {
        log.error({ err: error }, "Error generating secondary agency letters");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate letters" },
            { status: 500 }
        );
    }
}
