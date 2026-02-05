import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import {
  signPortalToken,
  signRefreshToken,
  verifyRefreshToken,
  extractBearerToken,
} from "@/lib/jwt";
import { createLogger } from "@/lib/logger";
const log = createLogger("portal-auth-api");

// Schema for client login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Schema for client registration (accepting invite)
const registerSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Schema for token refresh
const refreshSchema = z.object({
  refreshToken: z.string(),
});

// POST /api/portal/auth - Client login
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const rateLimitResult = checkRateLimit(ip, "auth");

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Find portal access by email
    const portalAccess = await prisma.clientPortalAccess.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        client: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                settings: true,
              },
            },
          },
        },
      },
    });

    if (!portalAccess) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (portalAccess.lockedUntil && new Date() < portalAccess.lockedUntil) {
      const remainingMinutes = Math.ceil(
        (portalAccess.lockedUntil.getTime() - Date.now()) / 1000 / 60
      );
      return NextResponse.json(
        {
          error: `Account locked. Try again in ${remainingMinutes} minutes.`,
        },
        { status: 423 }
      );
    }

    // Check if account is active
    if (!portalAccess.isActive) {
      return NextResponse.json(
        { error: "Account has been deactivated" },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, portalAccess.passwordHash);

    if (!isValid) {
      // Increment login attempts
      const newAttempts = portalAccess.loginAttempts + 1;
      const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await prisma.clientPortalAccess.update({
        where: { id: portalAccess.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil: lockUntil,
        },
      });

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Reset login attempts and update last login
    await prisma.clientPortalAccess.update({
      where: { id: portalAccess.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT tokens
    const accessToken = await signPortalToken({
      clientId: portalAccess.client.id,
      email: portalAccess.email,
      portalAccessId: portalAccess.id,
      organizationId: portalAccess.client.organization.id,
    });

    const refreshToken = await signRefreshToken({
      clientId: portalAccess.client.id,
      portalAccessId: portalAccess.id,
    });

    return NextResponse.json({
      success: true,
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
      client: {
        id: portalAccess.client.id,
        firstName: portalAccess.client.firstName,
        lastName: portalAccess.client.lastName,
        email: portalAccess.email,
      },
      organization: {
        id: portalAccess.client.organization.id,
        name: portalAccess.client.organization.name,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Client portal login error");
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}

// PUT /api/portal/auth - Accept invite and set password
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Find the portal access by invite token (stored in id)
    const portalAccess = await prisma.clientPortalAccess.findFirst({
      where: {
        id: token,
        acceptedAt: null,
      },
    });

    if (!portalAccess) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 400 }
      );
    }

    // Hash password and update
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.clientPortalAccess.update({
      where: { id: portalAccess.id },
      data: {
        passwordHash,
        acceptedAt: new Date(),
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Account activated. You can now log in.",
    });
  } catch (error) {
    log.error({ err: error }, "Client portal registration error");
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}

// PATCH /api/portal/auth - Refresh access token
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = refreshSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    const { refreshToken } = validation.data;

    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Verify portal access still exists and is active
    const portalAccess = await prisma.clientPortalAccess.findFirst({
      where: {
        id: payload.portalAccessId,
        isActive: true,
      },
      include: {
        client: {
          include: {
            organization: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!portalAccess) {
      return NextResponse.json(
        { error: "Account not found or deactivated" },
        { status: 401 }
      );
    }

    // Generate new access token
    const accessToken = await signPortalToken({
      clientId: portalAccess.client.id,
      email: portalAccess.email,
      portalAccessId: portalAccess.id,
      organizationId: portalAccess.client.organization.id,
    });

    return NextResponse.json({
      success: true,
      accessToken,
      expiresIn: 3600,
    });
  } catch (error) {
    log.error({ err: error }, "Token refresh error");
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/portal/auth - Logout (invalidate refresh token)
export async function DELETE(request: NextRequest) {
  // In a full implementation, you would:
  // 1. Store refresh tokens in Redis/DB
  // 2. Delete/invalidate the refresh token on logout
  // For now, we just acknowledge the logout
  // The client should clear tokens from localStorage

  return NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });
}
