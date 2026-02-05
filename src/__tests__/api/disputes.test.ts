/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";

// Mock logger to prevent pino import issues
const mockLogFn = jest.fn();
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn().mockReturnValue({
    info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn,
    child: jest.fn().mockReturnValue({ info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn }),
  }),
  logger: { info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn },
}));

// Mock next/headers (synchronous, like working clients.test.ts)
jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({
    get: jest.fn(), getAll: jest.fn().mockReturnValue([]),
    set: jest.fn(), delete: jest.fn(), has: jest.fn().mockReturnValue(false),
  })),
}));

const mockPrisma = {
  dispute: { count: jest.fn().mockResolvedValue(0 as never), findMany: jest.fn().mockResolvedValue([] as never), findFirst: jest.fn().mockResolvedValue(null as never), create: jest.fn(), update: jest.fn() },
  client: { count: jest.fn().mockResolvedValue(0 as never), findFirst: jest.fn() },
  accountItem: { findMany: jest.fn().mockResolvedValue([] as never) },
  creditReport: { count: jest.fn().mockResolvedValue(0 as never), findFirst: jest.fn().mockResolvedValue(null as never) },
  ameliaContentHash: { findMany: jest.fn().mockResolvedValue([] as never), create: jest.fn().mockResolvedValue({} as never) },
  document: { count: jest.fn().mockResolvedValue(0 as never) },
  eventLog: { create: jest.fn().mockResolvedValue({} as never) },
};
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: mockPrisma, prisma: mockPrisma }));

const mockGetServerSession = jest.fn();
// Mock both next-auth paths (critical for withAuth to find the mock)
jest.mock("next-auth", () => ({
  __esModule: true, default: jest.fn(),
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));
jest.mock("next-auth/next", () => ({
  __esModule: true, default: jest.fn(),
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/redis", () => ({ cacheGet: jest.fn().mockResolvedValue(null as never), cacheSet: jest.fn().mockResolvedValue(undefined as never), cacheDel: jest.fn().mockResolvedValue(undefined as never), cacheDelPrefix: jest.fn().mockResolvedValue(undefined as never) }));
jest.mock("@/lib/amelia/index", () => ({ generateLetter: jest.fn().mockReturnValue({ content: "Generated dispute letter content", contentHash: "mock-hash-abc123", tone: "ASSERTIVE", isBackdated: false, backdatedDays: 0, letterDate: new Date("2025-01-28"), flow: "ACCURACY", effectiveFlow: "ACCURACY", round: 1, statute: "FCRA 611", includesScreenshots: false, personalInfoDisputed: { previousNames: [], previousAddresses: [], hardInquiries: [] }, letterStructure: "DAMAGES_FIRST" }) }));
jest.mock("@/lib/dispute-templates", () => ({ getDisputeReasonFromIssueCode: jest.fn().mockReturnValue("Information is inaccurate and requires verification") }));
jest.mock("@/lib/personal-info-dispute-service", () => ({ getActiveDisputes: jest.fn().mockResolvedValue([] as never), getLastDisputeDate: jest.fn().mockResolvedValue(null as never), recordDisputedItems: jest.fn().mockResolvedValue(undefined as never) }));
jest.mock("@/lib/dispute-id-generator", () => ({ generateDisputeCode: jest.fn().mockResolvedValue({ code: "D2GO-20250128-001", sequence: 1, dateKey: "20250128" } as never) }));
const mockCheckAccountAvailability = jest.fn().mockResolvedValue({ locked: [], available: [] } as never);
jest.mock("@/lib/account-lock-service", () => ({ checkAccountAvailability: mockCheckAccountAvailability }));
jest.mock("date-fns", () => ({ format: jest.fn().mockReturnValue("01/28/2025") }));
jest.mock("@/lib/pagination", () => ({
  parsePaginationParams: (sp: any) => ({
    page: parseInt(sp.get("page") || "1"),
    limit: parseInt(sp.get("limit") || "20"),
    skip: (parseInt(sp.get("page") || "1") - 1) * parseInt(sp.get("limit") || "20"),
  }),
  buildPaginatedResponse: (data: any[], total: number, p: any) => ({
    data,
    pagination: { page: p.page, limit: p.limit, total, pages: Math.ceil(total / p.limit), hasNext: p.page < Math.ceil(total / p.limit), hasPrev: p.page > 1 },
  }),
}));

// Dynamic import to ensure mocks are applied first
import { NextRequest } from "next/server";
import { SubscriptionTier } from "@/types";

let GET: any, POST: any;
beforeAll(async () => {
  const mod = await import("@/app/api/disputes/route");
  GET = mod.GET;
  POST = mod.POST;
});

function createMockSession(overrides?: Partial<any>) {
  return { user: { id: "user-123", email: "test@example.com", name: "Test User", role: "ADMIN", organizationId: "org-123", organizationName: "Test Org", subscriptionTier: SubscriptionTier.PROFESSIONAL, subscriptionStatus: "ACTIVE", ...overrides } };
}

describe("API /api/disputes", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetServerSession.mockReset(); });

  describe("GET /api/disputes", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/disputes");
      const res = await GET(req, undefined);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("returns disputes list for authenticated user with org filter", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.dispute.count.mockResolvedValue(1 as never);
      mockPrisma.dispute.findMany.mockResolvedValue([{ id: "dispute-1", client: { id: "c1", firstName: "John", lastName: "Doe" }, items: [{ id: "item-1", accountItem: { id: "a1", creditorName: "Bank", maskedAccountId: "X1234", balance: 1500 } }], documents: [], _count: { items: 1, documents: 0 } }] as never);
      const req = new NextRequest("http://localhost:3000/api/disputes?page=1&limit=20");
      const res = await GET(req, undefined);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe("dispute-1");
      expect(data.pagination.total).toBe(1);
      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-123" }) }));
    });

    it("filters by clientId when provided", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.dispute.count.mockResolvedValue(0 as never);
      mockPrisma.dispute.findMany.mockResolvedValue([] as never);
      const req = new NextRequest("http://localhost:3000/api/disputes?clientId=client-abc");
      await GET(req, undefined);
      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-123", clientId: "client-abc" }) }));
    });

    it("returns paginated response with correct metadata", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.dispute.count.mockResolvedValue(50 as never);
      mockPrisma.dispute.findMany.mockResolvedValue([] as never);
      const req = new NextRequest("http://localhost:3000/api/disputes?page=2&limit=10");
      const res = await GET(req, undefined);
      const data = await res.json();
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.total).toBe(50);
      expect(data.pagination.pages).toBe(5);
      expect(data.pagination.hasNext).toBe(true);
      expect(data.pagination.hasPrev).toBe(true);
    });
  });

  describe("POST /api/disputes", () => {
    const validBody = { clientId: "550e8400-e29b-41d4-a716-446655440000", cra: "TRANSUNION", flow: "ACCURACY", accountIds: ["660e8400-e29b-41d4-a716-446655440001"] };

    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/disputes", { method: "POST", body: JSON.stringify(validBody) });
      const res = await POST(req, undefined);
      expect(res.status).toBe(401);
    });

    it("returns 404 when client not found", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.client.findFirst.mockResolvedValue(null as never);
      const req = new NextRequest("http://localhost:3000/api/disputes", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await POST(req, undefined);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Client not found");
    });

    it("returns 400 when no valid accounts found", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.client.findFirst.mockResolvedValue({ id: validBody.clientId, firstName: "J", lastName: "D", organizationId: "org-123" } as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([] as never);
      const req = new NextRequest("http://localhost:3000/api/disputes", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await POST(req, undefined);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("No valid accounts found for the specified CRA");
    });

    it("returns 409 when accounts are locked", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.client.findFirst.mockResolvedValue({ id: validBody.clientId, firstName: "J", lastName: "D", organizationId: "org-123" } as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([{ id: validBody.accountIds[0], creditorName: "Bank", maskedAccountId: "X", cra: "TRANSUNION", organizationId: "org-123" }] as never);
      mockCheckAccountAvailability.mockResolvedValue({ locked: [{ accountId: validBody.accountIds[0], creditorName: "Bank", lockedBy: { disputeCode: "D2GO-20250128-001", system: "DISPUTE", status: "SENT", round: 1 } }], available: [] });
      const req = new NextRequest("http://localhost:3000/api/disputes", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await POST(req, undefined);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe("ACCOUNTS_LOCKED");
    });

    it("creates dispute with valid data", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      const mockClient = { id: validBody.clientId, firstName: "John", lastName: "Doe", addressLine1: "123 Main", city: "Springfield", state: "IL", zipCode: "62701", ssnLast4: "1234", dateOfBirth: new Date("1990-01-01"), organizationId: "org-123" };
      const mockAccounts = [{ id: validBody.accountIds[0], creditorName: "Test Bank", maskedAccountId: "XXXX1234", cra: "TRANSUNION", organizationId: "org-123", detectedIssues: null, suggestedFlow: "ACCURACY", balance: 1500, accountType: "CREDIT_CARD" }];
      const mockCreated = { id: "new-dispute-id", clientId: validBody.clientId, organizationId: "org-123", cra: "TRANSUNION", flow: "ACCURACY", round: 1, status: "DRAFT", disputeCode: "D2GO-20250128-001", createdAt: new Date("2025-01-28"), items: [{ id: "i1", accountItemId: validBody.accountIds[0], disputeReason: "Information is inaccurate and requires verification", accountItem: mockAccounts[0] }] };
      const mockUpdated = { ...mockCreated, letterContent: "Generated dispute letter content", aiStrategy: JSON.stringify({ tone: "ASSERTIVE" }), client: { id: validBody.clientId, firstName: "John", lastName: "Doe" }, items: [{ id: "i1", disputeReason: "Information is inaccurate and requires verification", accountItem: { id: validBody.accountIds[0], creditorName: "Test Bank", maskedAccountId: "XXXX1234", balance: 1500, accountType: "CREDIT_CARD", detectedIssues: null } }] };

      mockPrisma.client.findFirst.mockResolvedValue(mockClient as never);
      mockPrisma.accountItem.findMany.mockResolvedValue(mockAccounts as never);
      mockCheckAccountAvailability.mockResolvedValue({ locked: [], available: validBody.accountIds });
      mockPrisma.dispute.findFirst.mockResolvedValue(null as never);
      mockPrisma.dispute.create.mockResolvedValue(mockCreated as never);
      mockPrisma.dispute.update.mockResolvedValue(mockUpdated as never);

      const req = new NextRequest("http://localhost:3000/api/disputes", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await POST(req, undefined);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dispute.disputeCode).toBe("D2GO-20250128-001");
      expect(data.dispute.status).toBe("DRAFT");
      expect(data.amelia).toBeDefined();
      expect(data.amelia.tone).toBe("ASSERTIVE");
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org-123", cra: "TRANSUNION", status: "DRAFT", round: 1 }) }));
    });

    it("returns 400 when previous round not sent", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.client.findFirst.mockResolvedValue({ id: validBody.clientId, firstName: "J", lastName: "D", organizationId: "org-123" } as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([{ id: validBody.accountIds[0], creditorName: "Bank", maskedAccountId: "X", cra: "TRANSUNION", organizationId: "org-123" }] as never);
      mockCheckAccountAvailability.mockResolvedValue({ locked: [], available: validBody.accountIds });
      mockPrisma.dispute.findFirst.mockResolvedValue({ id: "old", round: 1, status: "DRAFT" } as never);
      const req = new NextRequest("http://localhost:3000/api/disputes", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await POST(req, undefined);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Cannot create Round 2");
    });

    it("returns 429 when dispute limit reached", async () => {
      // FREE tier limit is 15 disputes/month — set count to 15 to trigger limit
      mockGetServerSession.mockResolvedValue(createMockSession({ subscriptionTier: SubscriptionTier.FREE }));
      mockPrisma.dispute.count.mockResolvedValue(15 as never);
      const req = new NextRequest("http://localhost:3000/api/disputes", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await POST(req, undefined);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.code).toBe("LIMIT_REACHED");
    });
  });
});
