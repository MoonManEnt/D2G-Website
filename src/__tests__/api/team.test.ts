/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  user: {
    findMany: jest.fn().mockResolvedValue([] as never),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
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
jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed-pw" as never) }));

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

describe("/api/team", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetServerSession.mockReset(); });

  describe("GET", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { GET } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", headers: new Map() } as any;
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns team members for authenticated user", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const mockUsers = [
        { id: "u-1", email: "admin@example.com", name: "Admin", role: "ADMIN", isActive: true, lastLoginAt: null, createdAt: new Date(), profilePicture: null, _count: { uploadedReports: 5, createdDocuments: 3 } },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers as never);
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-123", name: "Test Org", subscriptionTier: "PROFESSIONAL" } as never);
      const { GET } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", headers: new Map() } as any;
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.team).toBeDefined();
      expect(Array.isArray(body.team)).toBe(true);
      expect(body.roles).toBeDefined();
      expect(body.limits).toBeDefined();
    });
  });

  describe("POST", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { POST } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", json: jest.fn().mockResolvedValue({} as never), headers: new Map() } as any;
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for SPECIALIST role", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "SPECIALIST" }));
      mockPrisma.user.findUnique.mockResolvedValue({ role: "SPECIALIST" } as never);
      const { POST } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", json: jest.fn().mockResolvedValue({ email: "new@example.com", name: "New User", role: "SPECIALIST" } as never), headers: new Map() } as any;
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("returns 403 for VIEWER role", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "VIEWER" }));
      mockPrisma.user.findUnique.mockResolvedValue({ role: "VIEWER" } as never);
      const { POST } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", json: jest.fn().mockResolvedValue({ email: "new@example.com", name: "New User", role: "SPECIALIST" } as never), headers: new Map() } as any;
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("allows OWNER to add team member", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "OWNER" }));
      mockPrisma.user.findUnique.mockImplementation(((args: any) => {
        if (args.where.id) return Promise.resolve({ role: "OWNER" });
        if (args.where.email) return Promise.resolve(null);
        return Promise.resolve(null);
      }) as any);
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-123", subscriptionTier: "PROFESSIONAL", users: [{ id: "u-1", isActive: true }] } as never);
      mockPrisma.user.create.mockResolvedValue({ id: "u-new", email: "new@example.com", name: "New User", role: "SPECIALIST" } as never);
      const { POST } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", json: jest.fn().mockResolvedValue({ email: "new@example.com", name: "New User", role: "SPECIALIST" } as never), headers: new Map() } as any;
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.user.email).toBe("new@example.com");
    });

    it("allows ADMIN to add team member", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "ADMIN" }));
      mockPrisma.user.findUnique.mockImplementation(((args: any) => {
        if (args.where.id) return Promise.resolve({ role: "ADMIN" });
        if (args.where.email) return Promise.resolve(null);
        return Promise.resolve(null);
      }) as any);
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-123", subscriptionTier: "PROFESSIONAL", users: [{ id: "u-1", isActive: true }] } as never);
      mockPrisma.user.create.mockResolvedValue({ id: "u-new", email: "new@example.com", name: "New User", role: "SPECIALIST" } as never);
      const { POST } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", json: jest.fn().mockResolvedValue({ email: "new@example.com", name: "New User", role: "SPECIALIST" } as never), headers: new Map() } as any;
      const res = await POST(req);
      expect(res.status).toBe(201);
    });

    it("returns 400 for invalid email", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "OWNER" }));
      mockPrisma.user.findUnique.mockImplementation(((args: any) => {
        if (args.where.id) return Promise.resolve({ role: "OWNER" });
        return Promise.resolve(null);
      }) as any);
      const { POST } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", json: jest.fn().mockResolvedValue({ email: "not-an-email", name: "New User", role: "SPECIALIST" } as never), headers: new Map() } as any;
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for duplicate email", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ role: "OWNER" }));
      mockPrisma.user.findUnique.mockImplementation(((args: any) => {
        if (args.where.id) return Promise.resolve({ role: "OWNER" });
        if (args.where.email) return Promise.resolve({ id: "existing", email: "existing@example.com" });
        return Promise.resolve(null);
      }) as any);
      const { POST } = await import("@/app/api/team/route");
      const req = { url: "http://localhost/api/team", json: jest.fn().mockResolvedValue({ email: "existing@example.com", name: "Existing User", role: "SPECIALIST" } as never), headers: new Map() } as any;
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("already exists");
    });
  });
});
