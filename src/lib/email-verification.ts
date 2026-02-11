import prisma from "@/lib/prisma";
import { sendEmail, getOrganizationBranding } from "@/lib/email";
import { emailVerificationTemplate } from "@/lib/email-templates";
import crypto from "crypto";
import { createLogger } from "./logger";
const log = createLogger("email-verification");

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * Send a verification email to a user.
 * Generates a token, stores it in the database, and sends the email.
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing verification tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });

    // Create new token
    await prisma.emailVerificationToken.create({
      data: {
        token,
        email: email.toLowerCase(),
        userId,
        expiresAt,
      },
    });

    // Build verification URL
    const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;

    // Get branding
    const branding = await getOrganizationBranding(organizationId);

    // Build email template
    const html = emailVerificationTemplate(
      {
        userName: name,
        verificationUrl,
        expiresIn: "24 hours",
      },
      { branding }
    );

    // Send email
    const result = await sendEmail({
      to: email.toLowerCase(),
      template: {
        subject: "Verify Your Email Address",
        html,
        text: `Hi ${name},\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, you can safely ignore this email.`,
      },
      tags: [{ name: "category", value: "email-verification" }],
    });

    if (!result.success) {
      log.error({ err: result.error }, "Failed to send verification email");
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "Error sending verification email");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
