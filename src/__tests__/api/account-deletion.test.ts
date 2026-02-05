/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// =============================================================================
// MOCKS
// =============================================================================

const mockTransaction = jest.fn().mockImplementation((cb: any) => cb({
  eventLog: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  dispute: { findMany: jest.fn().mockResolvedValue([] as never), deleteMany: jest.fn().mockResolvedValue({} as never) },
  disputeItem: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  accountItem: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  creditReport: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  creditScore: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  client: { findMany: jest.fn().mockResolvedValue([] as never), deleteMany: jest.fn().mockResolvedValue({} as never) },
  user: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  organization: { delete: jest.fn().mockResolvedValue({} as never) },
}));

const mockPrisma = {
  eventLog: { create: jest.fn().mockResolvedValue({} as never) },
  $transaction: mockTransaction,
};

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetServerSession = jest.fn();
jest.mock("next/headers", () => ({ headers: jest.fn(() => new Map()), cookies: jest.fn(() => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() })) }));
jest.mock("next-auth", () => ({ __esModule: true, default: jest.fn(), getServerSession: (...args: any[]) => mockGetServerSession(...args) }));
jest.mock("next-auth/next", () => ({ __esModule: true, default: jest.fn(), getServerSession: (...args: any[]) => mockGetServerSession(...args) }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

function createSession(overrides?: Record<string, unknown>) {
  return {
    user: {
      id: "user-123", email: "owner@example.com", name: "Owner",
      role: "OWNER", organizationId: "org-123", organizationName: "Test Org",
      subscriptionTier: "PROFESSIONAL", subscriptionStatus: "ACTIVE",
      ...overrides,
    },
  };
}

function createRequest(body: unknown) {
  return {
    url: "http://localhost/api/user/account",
    json: jest.fn().mockResolvedValue(body as never),
    headers: new Map(),
  } as any;
}

describe("/api/user/account", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetServerSession.mockReset(); });

  describe("DELETE", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { DELETE } = await import("@/app/api/user/account/route");
      const res = await DELETE(createRequest({ confirmation: "DELETE MY ACCOUNT" }));
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-OWNER role (ADMIN)", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "ADMIN" }));
      const { DELETE } = await import("@/app/api/user/account/route");
      const res = await DELETE(createRequest({ confirmation: "DELETE MY ACCOUNT" }));
      expect(res.status).toBe(403);
    });

    it("returns 403 for SPECIALIST role", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "SPECIALIST" }));
      const { DELETE } = await import("@/app/api/user/account/route");
      const res = await DELETE(createRequest({ confirmation: "DELETE MY ACCOUNT" }));
      expect(res.status).toBe(403);
    });

    it("returns 400 without confirmation string", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const { DELETE } = await import("@/app/api/user/account/route");
      const res = await DELETE(createRequest({ confirmation: "wrong" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Confirmation required");
    });

    it("returns 400 with empty confirmation", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const { DELETE } = await import("@/app/api/user/account/route");
      const res = await DELETE(createRequest({}));
      expect(res.status).toBe(400);
    });

    it("cascades deletion in transaction with correct confirmation", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const { DELETE } = await import("@/app/api/user/account/route");
      const res = await DELETE(createRequest({ confirmation: "DELETE MY ACCOUNT" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
      expect(body.organizationId).toBe("org-123");
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("logs GDPR event before deletion", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const { DELETE } = await import("@/app/api/user/account/route");
      await DELETE(createRequest({ confirmation: "DELETE MY ACCOUNT" }));
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: "GDPR_ACCOUNT_DELETION" }) })
      );
    });
  });
});
