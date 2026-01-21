import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Client-side upload endpoint for large files.
 * The file goes directly from browser to Vercel Blob - never passes through this function.
 * This endpoint just generates secure upload tokens.
 * Supports files up to 500MB (Vercel Blob limit).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check for authentication cookie
  const sessionCookie = request.cookies.get('next-auth.session-token') ||
                        request.cookies.get('__Secure-next-auth.session-token');

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Validate it's a PDF upload to the reports folder
        if (!pathname.startsWith('reports/') || !pathname.endsWith('.pdf')) {
          throw new Error('Invalid file path');
        }

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB max
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Log successful uploads
        console.log('Upload completed:', blob.pathname, blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
}
