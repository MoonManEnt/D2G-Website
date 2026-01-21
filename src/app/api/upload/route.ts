import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// This endpoint handles client-side upload token generation
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Authenticate the user before allowing upload
        const session = await getServerSession(authOptions);

        if (!session?.user) {
          throw new Error('Unauthorized');
        }

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          tokenPayload: JSON.stringify({
            userId: session.user.id,
            organizationId: session.user.organizationId,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This runs after the file is uploaded to blob storage
        console.log('Upload completed:', blob.url);
        console.log('Token payload:', tokenPayload);
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
