import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Diagnostic endpoint to check blob configuration
export async function GET(): Promise<NextResponse> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  return NextResponse.json({
    hasToken: !!token,
    tokenPrefix: token ? token.substring(0, 20) + '...' : null,
    tokenLength: token ? token.length : 0,
    startsWithVercel: token ? token.startsWith('vercel_blob_') : false,
  });
}
