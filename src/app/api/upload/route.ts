import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Generate upload URL for client
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = request.cookies.get('next-auth.session-token') ||
                          request.cookies.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Generate unique pathname
    const randomId = Math.random().toString(36).substring(2, 15);
    const pathname = `reports/${randomId}.pdf`;

    // Return the pathname and token for direct upload
    return NextResponse.json({
      pathname,
      uploadToken: token,
    });
  } catch (error) {
    console.error('Upload token error:', error);
    return NextResponse.json({ error: 'Failed to generate upload token' }, { status: 500 });
  }
}

// Alternative: server-side upload for small files
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = request.cookies.get('next-auth.session-token') ||
                          request.cookies.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const randomId = Math.random().toString(36).substring(2, 15);
      const pathname = `reports/${randomId}.pdf`;

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

    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });

  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
