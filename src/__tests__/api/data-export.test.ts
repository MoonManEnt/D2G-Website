/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  organization: { findUnique: jest.fn() },
  user: { findMany: jest.fn().mockResolvedValue([] as never) },
  client: { findMany: jest.fn().mockResolvedValue([] as never) },
  dispute: { findMany: jest.fn().mockResolvedValue([] as never) },
  creditReport: { findMany: jest.fn().mockResolvedValue([] as never) },
  creditScore: { findMany: jest.fn().mockResolvedValue([] as never) },
  eventLog: {
    findMany: jest.fn().mockResolvedValue([] as never),
    create: jest.fn().mockResolvedValue({} as never),
  },
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
jest.mock("@/lib/encryption", () => ({
  decryptPIIFields: (data: Record<string, unknown>) => data,
}));

function createSession(overrides?: Record<string, unknown>) {
  return {
    user: {
      id: "user-123", email: "test@example.com", name: "Test User",
      role: "ADMIN", organizationId: "org-123", organizationName: "Test Org",
      subscriptionTier: "PROFESSIONAL", subscriptionStatus: "ACTIVE",
      ...overrides,
    },
  };
}

describe("/api/user/data-export", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetServerSession.mockReset(); });

  describe("GET", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { GET } = await import("@/app/api/user/data-export/route");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 for SPECIALIST role", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "SPECIALIST" }));
      const { GET } = await import("@/app/api/user/data-export/route");
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns 403 for VIEWER role", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "VIEWER" }));
      const { GET } = await import("@/app/api/user/data-export/route");
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns JSON export for OWNER", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "OWNER" }));
      mockPrisma.organization.findUnique.mockResolvedValue({ name: "Test Org", slug: "test-org", createdAt: new Date() } as never);
      const { GET } = await import("@/app/api/user/data-export/route");
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("Content-Type")).toBe("application/json");
      const text = await res.text();
      const body = JSON.parse(text);
      expect(body.format).toBe("dispute2go-gdpr-export-v1");
      expect(body.organization).toBeDefined();
    });

    it("returns JSON export for ADMIN", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "ADMIN" }));
      mockPrisma.organization.findUnique.mockResolvedValue({ name: "Test Org", slug: "test-org", createdAt: new Date() } as never);
      const { GET } = await import("@/app/api/user/data-export/route");
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
    });

    it("sets Content-Disposition header with filename", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "OWNER" }));
      mockPrisma.organization.findUnique.mockResolvedValue({ name: "Test Org", slug: "test-org", createdAt: new Date() } as never);
      const { GET } = await import("@/app/api/user/data-export/route");
      const res = await GET();
      const disposition = res.headers.get("Content-Disposition");
      expect(disposition).toContain("dispute2go-export");
      expect(disposition).toContain("org-123");
    });

    it("logs GDPR_DATA_EXPORT event", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "OWNER" }));
      mockPrisma.organization.findUnique.mockResolvedValue({ name: "Test Org", slug: "test-org", createdAt: new Date() } as never);
      const { GET } = await import("@/app/api/user/data-export/route");
      await GET();
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: "GDPR_DATA_EXPORT" }) })
      );
    });
  });
});
