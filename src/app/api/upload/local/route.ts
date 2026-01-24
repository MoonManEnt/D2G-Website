import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFile, generateFileKey } from "@/lib/storage";
import { v4 as uuid } from "uuid";

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

        const buffer = Buffer.from(await file.arrayBuffer());
        const organizationId = session.user.organizationId;

        // Use the storage lib's generateFileKey which maintains the nested structure orgId/type/filename
        const key = generateFileKey(organizationId, type, file.name);
        const contentType = file.type || "application/octet-stream";

        console.log(`📂 [LOCAL-UPLOAD] Uploading ${file.name} to ${key}`);

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
        console.error("❌ [LOCAL-UPLOAD] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 }
        );
    }
}
