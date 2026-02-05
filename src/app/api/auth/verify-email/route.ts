import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";
import { createLogger } from "@/lib/logger";
const log = createLogger("verify-email-api");

// GET /api/auth/verify-email?token=xxx - Verify email from link click
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/login?error=missing-token", request.url)
      );
    }

    // Find the verification token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.redirect(
        new URL("/login?error=invalid-token", request.url)
      );
    }

    // Check if expired
    if (verificationToken.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
      return NextResponse.redirect(
        new URL("/login?error=expired-token", request.url)
      );
    }

    // Update user emailVerifiedAt and delete the used token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      }),
    ]);

    // Log verification event
    const user = await prisma.user.findUnique({
      where: { id: verificationToken.userId },
      select: { organizationId: true, email: true },
    });

    if (user) {
      await prisma.eventLog.create({
        data: {
          eventType: "USER_EMAIL_VERIFIED",
          actorId: verificationToken.userId,
          actorEmail: user.email,
          targetType: "User",
          targetId: verificationToken.userId,
          organizationId: user.organizationId,
        },
      });
    }

    return NextResponse.redirect(
      new URL("/login?verified=true", request.url)
    );
  } catch (error) {
    log.error({ err: error }, "Error verifying email");
    return NextResponse.redirect(
      new URL("/login?error=verification-failed", request.url)
    );
  }
}

// POST /api/auth/verify-email - Resend verification email
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        organizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    // Send verification email
    const result = await sendVerificationEmail(
      user.id,
      user.email,
      user.name,
      user.organizationId
    );

    if (!result.success) {
      log.error({ err: result.error }, "Failed to send verification email");
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    log.error({ err: error }, "Error resending verification email");
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
