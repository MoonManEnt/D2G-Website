import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { UserRole, SubscriptionTier, SubscriptionStatus } from "@/types";
import { getEnv } from "./env";
import { createLogger } from "./logger";
const log = createLogger("auth");

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      organizationId: string;
      organizationName: string;
      subscriptionTier: SubscriptionTier;
      subscriptionStatus: SubscriptionStatus;
      isFoundingMember: boolean;
      foundingMemberNumber: number | null;
      trialEndsAt: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
    organizationName: string;
    subscriptionTier: SubscriptionTier;
    subscriptionStatus: SubscriptionStatus;
    isFoundingMember: boolean;
    foundingMemberNumber: number | null;
    trialEndsAt: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
    organizationName: string;
    subscriptionTier: SubscriptionTier;
    subscriptionStatus: SubscriptionStatus;
    isFoundingMember: boolean;
    foundingMemberNumber: number | null;
    trialEndsAt: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  subscriptionTier: true,
                  subscriptionStatus: true,
                  isFoundingMember: true,
                  foundingMemberNumber: true,
                  trialEndsAt: true,
                },
              },
            },
          });

          if (!user) {
            throw new Error("Invalid email or password");
          }

          if (!user.isActive) {
            throw new Error("Your account has been deactivated");
          }

          const isPasswordValid = await compare(credentials.password, user.passwordHash);

          if (!isPasswordValid) {
            log.info({ data: credentials.email }, "Invalid password for");
            throw new Error("Invalid email or password");
          }

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          // Log login event
          await prisma.eventLog.create({
            data: {
              eventType: "USER_LOGIN",
              actorId: user.id,
              actorEmail: user.email,
              targetType: "User",
              targetId: user.id,
              organizationId: user.organizationId,
              eventData: JSON.stringify({
                timestamp: new Date().toISOString(),
              }),
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as UserRole,
            organizationId: user.organization.id,
            organizationName: user.organization.name,
            subscriptionTier: user.organization.subscriptionTier as SubscriptionTier,
            subscriptionStatus: user.organization.subscriptionStatus as SubscriptionStatus,
            isFoundingMember: user.organization.isFoundingMember,
            foundingMemberNumber: user.organization.foundingMemberNumber,
            trialEndsAt: user.organization.trialEndsAt?.toISOString() || null,
          };

        } catch (error) {
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.subscriptionTier = user.subscriptionTier;
        token.subscriptionStatus = user.subscriptionStatus;
        token.isFoundingMember = user.isFoundingMember;
        token.foundingMemberNumber = user.foundingMemberNumber;
        token.trialEndsAt = user.trialEndsAt;
      }

      // Refresh subscription data from DB when session update is requested
      if (trigger === "update" && token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: {
              organization: {
                select: {
                  subscriptionTier: true,
                  subscriptionStatus: true,
                  isFoundingMember: true,
                  foundingMemberNumber: true,
                  trialEndsAt: true,
                },
              },
            },
          });
          if (freshUser?.organization) {
            token.subscriptionTier = freshUser.organization.subscriptionTier as SubscriptionTier;
            token.subscriptionStatus = freshUser.organization.subscriptionStatus as SubscriptionStatus;
            token.isFoundingMember = freshUser.organization.isFoundingMember;
            token.foundingMemberNumber = freshUser.organization.foundingMemberNumber;
            token.trialEndsAt = freshUser.organization.trialEndsAt?.toISOString() || null;
          }
        } catch (err) {
          log.error({ err }, "Failed to refresh session data");
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        role: token.role,
        organizationId: token.organizationId,
        organizationName: token.organizationName,
        subscriptionTier: token.subscriptionTier,
        subscriptionStatus: token.subscriptionStatus,
        isFoundingMember: token.isFoundingMember,
        foundingMemberNumber: token.foundingMemberNumber,
        trialEndsAt: token.trialEndsAt,
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400", 10), // Default 24 hours
  },
  secret: getEnv().NEXTAUTH_SECRET,
};
