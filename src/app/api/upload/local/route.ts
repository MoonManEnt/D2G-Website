import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFile, generateFileKey } from "@/lib/storage";
import { validateUpload, UPLOAD_PRESETS } from "@/lib/upload-validation";
import { v4 as uuid } from "uuid";
import { createLogger } from "@/lib/logger";
const log = createLogger("local-upload-api");

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as "reports" | "evidence" | "documents" | "profiles" || "reports";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type, size, and extension
        const preset = type === "reports" ? UPLOAD_PRESETS.creditReport
            : type === "evidence" ? UPLOAD_PRESETS.evidenceScreenshot
            : UPLOAD_PRESETS.clientDocument;
        const validation = validateUpload(
            { name: file.name, size: file.size, type: file.type },
            preset
        );
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const organizationId = session.user.organizationId;

        // Use the storage lib's generateFileKey which maintains the nested structure orgId/type/filename
        const key = generateFileKey(organizationId, type, file.name);
        const contentType = file.type || "application/octet-stream";

        log.info({ name: file.name, key }, "[LOCAL-UPLOAD] Uploading to");

        const result = await uploadFile(buffer, key, contentType);

        // If it's a local upload, our storage utility returns /uploads/{key}
        // and stores it in path.join(process.cwd(), "uploads", key)

        return NextResponse.json({
            url: result.url,
            key: result.key,
            size: result.size,
            contentType: contentType,
        });

    } catch (error) {
        log.error({ err: error }, "[LOCAL-UPLOAD] Error");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 }
        );
    }
}
