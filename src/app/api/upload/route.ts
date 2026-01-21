import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

// Use edge runtime for streaming uploads (bypasses 4.5MB serverless limit)
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Simple server-side upload endpoint
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check for authentication cookie (edge runtime doesn't support getServerSession)
    const sessionCookie = request.cookies.get('next-auth.session-token') ||
                          request.cookies.get('__Secure-next-auth.session-token');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate unique filename
    const randomId = Math.random().toString(36).substring(2, 10);
    const filename = `reports/${randomId}.pdf`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
