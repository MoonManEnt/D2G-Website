import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from "@/lib/logger";
const log = createLogger("reports-upload-token-api");

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    log.info("DEBUG: POST /api/reports/upload-token called");

    // Check auth
    const sessionCookie = request.cookies.get('next-auth.session-token') ||
        request.cookies.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
        log.info("DEBUG: Unauthorized access attempt to upload-token");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = (await request.json()) as HandleUploadBody;
        log.info({ data: body.type }, "[UPLOAD-TOKEN] Request body type");

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            log.error("[UPLOAD-TOKEN] BLOB_READ_WRITE_TOKEN is missing! Local upload will fail.");
        }

        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname: string) => {
                log.info({ data: pathname }, "Generating token for pathname");

                // Allow any PDF file
                return {
                    allowedContentTypes: ['application/pdf'],
                    maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
                };
            },
            onUploadCompleted: async ({ blob }) => {
                log.info({ data: blob.url }, "Upload completed");
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        log.error({ err: error }, "Upload handler error");
        const message = error instanceof Error ? error.message : 'Upload failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

// Handle OPTIONS explicitly to ensure no 405s on preflight if middleware misses it
export async function OPTIONS() {
    return new NextResponse(null, { status: 200 });
}
