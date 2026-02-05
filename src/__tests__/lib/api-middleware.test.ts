/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";
import { SubscriptionTier } from "@/types";

// =============================================================================
// MOCKS
// =============================================================================

// Mock logger first to prevent pino import issues
const mockLogFn = jest.fn();
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn().mockReturnValue({
    info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn,
    child: jest.fn().mockReturnValue({ info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn }),
  }),
  logger: { info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn },
}));

// Mock Prisma
const mockPrisma = {
  dispute: {
    count: jest.fn().mockResolvedValue(0 as never),
    findMany: jest.fn().mockResolvedValue([] as never),
    findFirst: jest.fn().mockResolvedValue(null as never),
    create: jest.fn(),
    update: jest.fn(),
  },
  document: {
    count: jest.fn().mockResolvedValue(0 as never),
  },
  client: {
    count: jest.fn().mockResolvedValue(0 as never),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  creditReport: {
    count: jest.fn().mockResolvedValue(0 as never),
  },
  eventLog: {
    create: jest.fn().mockResolvedValue({} as never),
  },
};

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// Mock next-auth (both paths)
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  __esModule: true, default: jest.fn(),
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));
jest.mock("next-auth/next", () => ({
  __esModule: true, default: jest.fn(),
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

jest.mock("@/lib/auth", () => ({ authOptions: {} }));

// Dynamic import to ensure mocks are applied first
let withAuth: any, trackUsage: any, getUsageStats: any, SUBSCRIPTION_LIMITS: any;
beforeAll(async () => {
  const mod = await import("@/lib/api-middleware");
  withAuth = mod.withAuth;
  trackUsage = mod.trackUsage;
  getUsageStats = mod.getUsageStats;
  SUBSCRIPTION_LIMITS = mod.SUBSCRIPTION_LIMITS;
});

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockSession(overrides?: Partial<any>) {
  return {
    user: {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      role: "ADMIN",
      organizationId: "org-123",
      organizationName: "Test Org",
      subscriptionTier: SubscriptionTier.PROFESSIONAL,
      subscriptionStatus: "ACTIVE",
      ...overrides,
    },
  };
}

function createMockRequest(body?: any): any {
  return {
    json: jest.fn().mockResolvedValue(body || {} as never),
    method: "GET",
    headers: new Map(),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("API Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockReset();
  });

  describe("withAuth - Authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler);
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(401);
      const data = await result.json();
      expect(data.error).toBe("Unauthorized");
      expect(data.code).toBe("UNAUTHORIZED");
      expect(handler).not.toHaveBeenCalled();
    });

    it("returns 401 when session has no organizationId", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-1", organizationId: null },
      });

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler);
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it("passes through when valid session exists", async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const mockResponse = NextResponse.json({ success: true });
      const handler = jest.fn().mockResolvedValue(mockResponse as never);
      const wrappedHandler = withAuth(handler);
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockResponse);
    });

    it("passes correct context to handler", async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler);
      await wrappedHandler(createMockRequest(), { params: Promise.resolve({ id: "abc" }) });

      const [, context] = handler.mock.calls[0] as [any, any];
      expect(context.userId).toBe("user-123");
      expect(context.organizationId).toBe("org-123");
      expect(context.subscriptionTier).toBe(SubscriptionTier.PROFESSIONAL);
      expect(context.params.id).toBe("abc");
    });
  });

  describe("withAuth - Subscription Status", () => {
    it("returns 403 when subscription is inactive", async () => {
      const session = createMockSession({ subscriptionStatus: "CANCELED" });
      mockGetServerSession.mockResolvedValue(session);

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler);
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(403);
      const data = await result.json();
      expect(data.code).toBe("SUBSCRIPTION_INACTIVE");
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows ACTIVE subscription status", async () => {
      const session = createMockSession({ subscriptionStatus: "ACTIVE" });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler);
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("withAuth - Role-Based Access Control", () => {
    it("blocks when user role does not match required roles", async () => {
      const session = createMockSession({ role: "SPECIALIST" });
      mockGetServerSession.mockResolvedValue(session);

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler, { roles: ["ADMIN"] });
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(403);
      const data = await result.json();
      expect(data.code).toBe("ROLE_REQUIRED");
      expect(data.requiredRoles).toEqual(["ADMIN"]);
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows when user role matches required roles", async () => {
      const session = createMockSession({ role: "ADMIN" });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { roles: ["ADMIN"] });
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("allows when user role is in multiple accepted roles", async () => {
      const session = createMockSession({ role: "SPECIALIST" });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { roles: ["ADMIN", "SPECIALIST"] });
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("skips role check when no roles option specified", async () => {
      const session = createMockSession({ role: "SPECIALIST" });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler);
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("withAuth - Minimum Tier Check", () => {
    it("blocks FREE tier when PROFESSIONAL required", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.FREE });
      mockGetServerSession.mockResolvedValue(session);

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler, { minTier: SubscriptionTier.PROFESSIONAL });
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(403);
      const data = await result.json();
      expect(data.code).toBe("TIER_REQUIRED");
      expect(data.requiredTier).toBe(SubscriptionTier.PROFESSIONAL);
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows PROFESSIONAL tier when STARTER required", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.PROFESSIONAL });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { minTier: SubscriptionTier.STARTER });
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("allows ENTERPRISE tier for any min tier", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.ENTERPRISE });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { minTier: SubscriptionTier.PROFESSIONAL });
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("withAuth - Feature Access Check", () => {
    it("blocks access to feature not in current tier", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.FREE });
      mockGetServerSession.mockResolvedValue(session);

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler, { requiredFeature: "ai_letters" });
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(403);
      const data = await result.json();
      expect(data.code).toBe("FEATURE_UNAVAILABLE");
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows access to feature in current tier", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.PROFESSIONAL });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { requiredFeature: "ai_letters" });
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("withAuth - Usage Limit Check", () => {
    it("blocks when usage limit reached (429)", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.FREE });
      mockGetServerSession.mockResolvedValue(session);

      // FREE tier has 15 monthly disputes
      mockPrisma.dispute.count.mockResolvedValue(15 as never);

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler, { checkLimit: "disputes" });
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(429);
      const data = await result.json();
      expect(data.code).toBe("LIMIT_REACHED");
      expect(data.current).toBe(15);
      expect(data.limit).toBe(15);
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows when under usage limit", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.FREE });
      mockGetServerSession.mockResolvedValue(session);

      mockPrisma.dispute.count.mockResolvedValue(2 as never);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { checkLimit: "disputes" });
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("always allows ENTERPRISE tier (unlimited = -1)", async () => {
      const session = createMockSession({ subscriptionTier: SubscriptionTier.ENTERPRISE });
      mockGetServerSession.mockResolvedValue(session);

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { checkLimit: "disputes" });
      await wrappedHandler(createMockRequest(), undefined);

      expect(handler).toHaveBeenCalledTimes(1);
      // Should not even call prisma.dispute.count for unlimited
    });
  });

  describe("withAuth - Body Validation", () => {
    it("validates request body with schema", async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);
      const { z } = await import("zod");

      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const { NextResponse } = await import("next/server");
      const handler = jest.fn().mockResolvedValue(NextResponse.json({}) as never);
      const wrappedHandler = withAuth(handler, { schema });
      const req = createMockRequest({ name: "Test", email: "test@example.com" });
      await wrappedHandler(req, undefined);

      expect(handler).toHaveBeenCalledTimes(1);
      const [, context] = handler.mock.calls[0] as [any, any];
      expect(context.body).toEqual({ name: "Test", email: "test@example.com" });
    });

    it("returns 400 for invalid body", async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);
      const { z } = await import("zod");

      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const handler = jest.fn();
      const wrappedHandler = withAuth(handler, { schema });
      const req = createMockRequest({ name: "", email: "not-email" });
      const result = await wrappedHandler(req, undefined);

      expect(result.status).toBe(400);
      const data = await result.json();
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("withAuth - Error Handling", () => {
    it("returns 500 when handler throws", async () => {
      const session = createMockSession();
      mockGetServerSession.mockResolvedValue(session);

      const handler = jest.fn().mockRejectedValue(new Error("Unexpected error") as never);
      const wrappedHandler = withAuth(handler);
      const result = await wrappedHandler(createMockRequest(), undefined);

      expect(result.status).toBe(500);
      const data = await result.json();
      expect(data.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("trackUsage()", () => {
    it("creates event log entry for dispute_created", async () => {
      await trackUsage("org-123", "user-123", "dispute_created", { disputeId: "d-1" });

      expect(mockPrisma.eventLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "USAGE_DISPUTE_CREATED",
            actorId: "user-123",
            organizationId: "org-123",
            targetType: "dispute",
          }),
        })
      );
    });

    it("creates event log entry for letter_generated", async () => {
      await trackUsage("org-123", "user-123", "letter_generated");

      expect(mockPrisma.eventLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "USAGE_LETTER_GENERATED",
            targetType: "letter",
          }),
        })
      );
    });

    it("creates event log entry for report_uploaded", async () => {
      await trackUsage("org-123", "user-123", "report_uploaded");

      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "USAGE_REPORT_UPLOADED",
            targetType: "report",
          }),
        })
      );
    });

    it("creates event log entry for client_created", async () => {
      await trackUsage("org-123", "user-123", "client_created");

      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "USAGE_CLIENT_CREATED",
            targetType: "client",
          }),
        })
      );
    });

    it("does not throw when prisma fails (graceful error handling)", async () => {
      mockPrisma.eventLog.create.mockRejectedValue(new Error("DB error") as never);

      // Should not throw
      await expect(
        trackUsage("org-123", "user-123", "dispute_created")
      ).resolves.toBeUndefined();
    });

    it("includes metadata in event data", async () => {
      await trackUsage("org-123", "user-123", "dispute_created", {
        disputeId: "d-1",
        cra: "TRANSUNION",
      });

      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventData: expect.stringContaining("disputeId"),
          }),
        })
      );
    });
  });

  describe("SUBSCRIPTION_LIMITS", () => {
    it("FREE tier has correct limits", () => {
      const free = SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
      expect(free.disputes.monthly).toBe(15);
      expect(free.letters.monthly).toBe(15);
      expect(free.clients.total).toBe(5);
      expect(free.reports.monthly).toBe(10);
      expect(free.features).toContain("basic_disputes");
      expect(free.features).toContain("manual_letters");
      expect(free.features).not.toContain("ai_letters");
    });

    it("STARTER tier has higher limits than FREE", () => {
      const starter = SUBSCRIPTION_LIMITS[SubscriptionTier.STARTER];
      const free = SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
      expect(starter.disputes.monthly).toBeGreaterThan(free.disputes.monthly);
      expect(starter.letters.monthly).toBeGreaterThan(free.letters.monthly);
      expect(starter.clients.total).toBeGreaterThan(free.clients.total);
    });

    it("PROFESSIONAL tier includes ai_letters feature", () => {
      const pro = SUBSCRIPTION_LIMITS[SubscriptionTier.PROFESSIONAL];
      expect(pro.features).toContain("ai_letters");
      expect(pro.features).toContain("bulk_disputes");
    });

    it("ENTERPRISE tier has unlimited (-1) for all limits", () => {
      const enterprise = SUBSCRIPTION_LIMITS[SubscriptionTier.ENTERPRISE];
      expect(enterprise.disputes.monthly).toBe(-1);
      expect(enterprise.letters.monthly).toBe(-1);
      expect(enterprise.clients.total).toBe(-1);
      expect(enterprise.reports.monthly).toBe(-1);
    });

    it("ENTERPRISE tier uses wildcard for all features", () => {
      const enterprise = SUBSCRIPTION_LIMITS[SubscriptionTier.ENTERPRISE];
      expect(enterprise.features).toContain("*");
    });

    it("tier hierarchy: FREE < STARTER < PROFESSIONAL < ENTERPRISE", () => {
      const free = SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
      const starter = SUBSCRIPTION_LIMITS[SubscriptionTier.STARTER];
      const pro = SUBSCRIPTION_LIMITS[SubscriptionTier.PROFESSIONAL];
      const enterprise = SUBSCRIPTION_LIMITS[SubscriptionTier.ENTERPRISE];

      expect(free.disputes.monthly).toBeLessThan(starter.disputes.monthly);
      expect(starter.disputes.monthly).toBeLessThan(pro.disputes.monthly);
      // Enterprise is -1 (unlimited), which is technically less than pro's number
      // but semantically means unlimited
      expect(enterprise.disputes.monthly).toBe(-1);

      expect(free.features.length).toBeLessThan(starter.features.length);
      expect(starter.features.length).toBeLessThanOrEqual(pro.features.length);
    });
  });
});
