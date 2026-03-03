import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth-register");

const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  company: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fullName, company, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Generate unique slug
    const baseSlug = slugify(company);
    let slug = baseSlug;
    let slugExists = await prisma.organization.findUnique({ where: { slug } });
    let attempts = 0;
    while (slugExists && attempts < 10) {
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${baseSlug}-${suffix}`;
      slugExists = await prisma.organization.findUnique({ where: { slug } });
      attempts++;
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: company,
          slug,
          subscriptionTier: "FREE",
          subscriptionStatus: "ACTIVE",
        },
      });

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: fullName,
          role: "OWNER",
          organizationId: organization.id,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: "USER_CREATED",
          actorId: user.id,
          actorEmail: normalizedEmail,
          targetType: "User",
          targetId: user.id,
          organizationId: organization.id,
        },
      });

      return { organization, user };
    });

    log.info(
      { userId: result.user.id, organizationId: result.organization.id },
      "User registered successfully"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Registration failed");
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
