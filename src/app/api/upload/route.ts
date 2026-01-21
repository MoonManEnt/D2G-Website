import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

// Use edge runtime for streaming - no payload size limits
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Direct upload endpoint using Edge runtime.
 * Edge functions stream the request body, so there's no 4.5MB limit.
 * Supports files up to ~100MB.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check for authentication
    const sessionCookie = request.cookies.get('next-auth.session-token') ||
                          request.cookies.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Get filename from header or generate one
    const filename = request.headers.get('x-filename') || `report-${Date.now()}.pdf`;
    const contentType = request.headers.get('content-type') || 'application/pdf';

    // For multipart form data, extract the file
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Generate unique path
      const randomId = Math.random().toString(36).substring(2, 15);
      const pathname = `reports/${randomId}.pdf`;

      // Upload to Vercel Blob
      const blob = await put(pathname, file, {
        access: 'public',
        token,
        contentType: 'application/pdf',
      });

      return NextResponse.json({
        url: blob.url,
        pathname: blob.pathname,
        success: true
      });
    }

    // For raw binary upload
    const body = request.body;
    if (!body) {
      return NextResponse.json({ error: 'No file data' }, { status: 400 });
    }

    // Generate unique path
    const randomId = Math.random().toString(36).substring(2, 15);
    const pathname = `reports/${randomId}.pdf`;

    // Stream directly to Vercel Blob
    const blob = await put(pathname, body, {
      access: 'public',
      token,
      contentType: 'application/pdf',
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      success: true
    });

  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
