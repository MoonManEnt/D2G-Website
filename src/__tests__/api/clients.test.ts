/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// =============================================================================
// MOCKS
// =============================================================================

jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() })),
}));
const mockPrisma = {
  client: { count: jest.fn().mockResolvedValue(0 as never), findMany: jest.fn().mockResolvedValue([] as never), create: jest.fn() },
  dispute: { count: jest.fn().mockResolvedValue(0 as never) },
  document: { count: jest.fn().mockResolvedValue(0 as never) },
  creditReport: { count: jest.fn().mockResolvedValue(0 as never) },
  eventLog: { create: jest.fn().mockResolvedValue({} as never) },
};

jest.mock("@/lib/prisma", () => ({ __esModule: true, default: mockPrisma, prisma: mockPrisma }));

// Mock getServerSession by intercepting the entire chain
const mockGetServerSession = jest.fn();

// We must mock next-auth at every path that might be resolved
jest.mock("next-auth", () => {
  return { __esModule: true, default: jest.fn(), getServerSession: (...args: any[]) => mockGetServerSession(...args) };
});
jest.mock("next-auth/next", () => {
  return { __esModule: true, default: jest.fn(), getServerSession: (...args: any[]) => mockGetServerSession(...args) };
});

jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/encryption", () => ({ encryptPIIFields: (d: any) => d, decryptPIIFields: (d: any) => d }));
jest.mock("@/lib/pagination", () => ({
  parsePaginationParams: () => ({ page: 1, limit: 20, skip: 0 }),
  buildPaginatedResponse: (data: any[], total: number, p: any) => ({
    data,
    pagination: { page: p.page, limit: p.limit, total, pages: Math.ceil(total / p.limit), hasNext: false, hasPrev: false },
  }),
}));
jest.mock("@/lib/redis", () => ({
  cacheGet: jest.fn().mockResolvedValue(null as never),
  cacheSet: jest.fn().mockResolvedValue(undefined as never),
  cacheGetOrSet: jest.fn(),
  cacheDel: jest.fn().mockResolvedValue(undefined as never),
  cacheDelPrefix: jest.fn().mockResolvedValue(undefined as never),
}));

let GET: any, POST: any;
beforeAll(async () => { const mod = await import("@/app/api/clients/route"); GET = mod.GET; POST = mod.POST; });

function createSession(overrides?: Record<string, unknown>) {
  return { user: { id: "user-123", email: "test@example.com", name: "Test User", role: "ADMIN", organizationId: "org-123", organizationName: "Test Org", subscriptionTier: "PROFESSIONAL", subscriptionStatus: "ACTIVE", ...overrides } };
}

describe("/api/clients", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetServerSession.mockReset(); });

  describe("GET", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const res = await GET(new Request("http://localhost/api/clients") as any, undefined as any);
      expect(res.status).toBe(401);
    });

    it("returns clients list for authenticated user", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.count.mockResolvedValue(1 as never);
      mockPrisma.client.findMany.mockResolvedValue([{ id: "c-1", firstName: "John", lastName: "Doe", organizationId: "org-123", stage: "INTAKE", updatedAt: new Date(), lastActivityAt: null, _count: { reports: 1, disputes: 2 }, disputes: [] }] as never);
      const res = await GET(new Request("http://localhost/api/clients?page=1&limit=20") as any, undefined as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("scopes query to user organization", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ organizationId: "org-456" }));
      mockPrisma.client.count.mockResolvedValue(0 as never);
      mockPrisma.client.findMany.mockResolvedValue([] as never);
      await GET(new Request("http://localhost/api/clients") as any, undefined as any);
      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-456" }) }));
    });
  });

  describe("POST", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const res = await POST(new Request("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ firstName: "Jane", lastName: "Doe" }), headers: { "Content-Type": "application/json" } }) as any, undefined as any);
      expect(res.status).toBe(401);
    });

    it("creates a new client with valid data", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.create.mockResolvedValue({ id: "c-new", firstName: "Jane", lastName: "Smith", email: "jane@example.com", organizationId: "org-123" } as never);
      const res = await POST(new Request("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ firstName: "Jane", lastName: "Smith", email: "jane@example.com" }), headers: { "Content-Type": "application/json" } }) as any, undefined as any);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.firstName).toBe("Jane");
    });

    it("returns 400 for missing firstName", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const res = await POST(new Request("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ lastName: "Smith" }), headers: { "Content-Type": "application/json" } }) as any, undefined as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing lastName", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const res = await POST(new Request("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ firstName: "Jane" }), headers: { "Content-Type": "application/json" } }) as any, undefined as any);
      expect(res.status).toBe(400);
    });

    it("returns 403 when free-tier exceeds client limit", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ subscriptionTier: "FREE" }));
      mockPrisma.client.count.mockResolvedValue(5 as never);
      const res = await POST(new Request("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ firstName: "Jane", lastName: "Smith" }), headers: { "Content-Type": "application/json" } }) as any, undefined as any);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("plan's limit");
    });

    it("logs CLIENT_CREATED event", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.create.mockResolvedValue({ id: "c-new", firstName: "Jane", lastName: "Smith", organizationId: "org-123" } as never);
      await POST(new Request("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ firstName: "Jane", lastName: "Smith" }), headers: { "Content-Type": "application/json" } }) as any, undefined as any);
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "CLIENT_CREATED", targetType: "Client", targetId: "c-new" }) }));
    });
  });
});
