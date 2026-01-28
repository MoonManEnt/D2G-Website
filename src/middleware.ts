import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createClient } from "@vercel/kv";

// In-memory fallback for local development or if KV is not configured
const localRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function localRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const key = ip;
  const entry = localRateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    localRateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup local map
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of localRateLimitMap.entries()) {
      if (now > entry.resetTime) {
        localRateLimitMap.delete(key);
      }
    }
  }, 60000);
}

/**
 * Rate limit using Vercel KV with local fallback
 */
async function rateLimit(ip: string, limit: number, windowMs: number): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Use Vercel KV / Upstash if configured (Production/Preview)
  if (url && token) {
    const kv = createClient({
      url,
      token,
    });

    const key = `rate_limit:${ip}`;
    try {
      const count = await kv.incr(key);
      if (count === 1) {
        await kv.expire(key, Math.ceil(windowMs / 1000));
      }
      return count <= limit;
    } catch (error) {
      console.error("Rate limit error:", error);
      // Fail open (allow request) if Redis fails
      return true;
    }
  }

  // Fallback to local memory (Development)
  return localRateLimit(ip, limit, windowMs);
}

// Security headers to add to all responses
const securityHeaders = {
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Enable XSS filter
  "X-XSS-Protection": "1; mode=block",
  // Referrer policy
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Permissions policy
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Content Security Policy - Nonce-based for scripts, hash-based for styles
// Next.js injects inline scripts for hydration, so we use a per-request nonce
function buildCSP(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://*.sentry.io https://vercel.com https://*.vercel.com https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only upgrade to HTTPS in production
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    // Stricter limits for auth endpoints (only for mutation requests like login/reset)
    // We deny this only for POST requests to allow session polling/CSRF/provider checks (GETs)
    if ((pathname.includes("/auth/") || pathname.includes("/forgot-password") || pathname.includes("/reset-password")) && request.method === "POST") {
      const isAllowed = await rateLimit(ip, 10, 15 * 60 * 1000); // 10 failed attempts per 15 minutes
      if (!isAllowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too many authentication attempts. Please try again later." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "900",
            }
          }
        );
      }
    }
    // Standard API rate limit
    else if (!pathname.includes("/billing/webhook")) { // Skip webhooks
      const isAllowed = await rateLimit(ip, 100, 60 * 1000); // 100 requests per minute
      if (!isAllowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Please slow down." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            }
          }
        );
      }
    }
  }

  // Protected routes that require authentication
  const protectedPaths = [
    "/dashboard",
    "/clients",
    "/disputes",
    "/reports",
    "/evidence",
    "/negative-items",
    "/settings",
    "/billing",
    "/analytics",
    "/ledger",
  ];

  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath) {
    const token = await getToken({ req: request });

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ["/login", "/register", "/forgot-password"];
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (isAuthPath) {
    const token = await getToken({ req: request });

    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Generate a per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Create response and add security headers
  const response = NextResponse.next({
    headers: {
      "x-nonce": nonce,
    },
  });

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add nonce-based CSP header
  response.headers.set("Content-Security-Policy", buildCSP(nonce));

  // Add CORS headers for API routes
  if (pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
