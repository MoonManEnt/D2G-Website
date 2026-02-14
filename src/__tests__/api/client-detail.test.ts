/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  client: {
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  accountItem: {
    findMany: jest.fn().mockResolvedValue([] as never),
  },
  accountItem: { findMany: jest.fn().mockResolvedValue([] as never), deleteMany: jest.fn().mockResolvedValue({} as never) },
  eventLog: {
    create: jest.fn().mockResolvedValue({} as never),
  },
  disputeRoundHistory: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  document: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  disputeItem: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  dispute: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  pendingEvidence: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  evidence: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  creditReport: { findMany: jest.fn().mockResolvedValue([] as never), deleteMany: jest.fn().mockResolvedValue({} as never) },
  diffResult: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  storedFile: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  clientDocument: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  creditDNA: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  creditScore: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  communication: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  ameliaContentHash: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  personalInfoDispute: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  clientPortalAccess: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  reminder: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  clientArchiveSnapshot: { deleteMany: jest.fn().mockResolvedValue({} as never) },
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
  encryptPIIFields: (data: Record<string, unknown>) => data,
  decryptPIIFields: (data: Record<string, unknown>) => data,
}));
jest.mock("@/lib/redis", () => ({
  cacheGet: jest.fn().mockResolvedValue(null as never),
  cacheSet: jest.fn().mockResolvedValue(undefined as never),
  cacheDel: jest.fn().mockResolvedValue(undefined as never),
  cacheDelPrefix: jest.fn().mockResolvedValue(undefined as never),
}));
jest.mock("@/lib/archive/archive-service", () => ({
  ArchiveService: {
    createComprehensiveSnapshot: jest.fn().mockResolvedValue({
      metadata: { recordCounts: { disputes: 2, creditScores: 1, communications: 3, accounts: 5 }, snapshotSizeBytes: 1024 },
      ameliaContext: { recommendedAction: "START_FRESH", personalizedMessage: "Starting fresh", lastFlow: null, lastRound: 0, unresolvedCras: [] },
    } as never),
    saveArchiveSnapshot: jest.fn().mockResolvedValue(undefined as never),
  },
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

function mockClient(overrides?: Record<string, unknown>) {
  return {
    id: "client-1", firstName: "John", lastName: "Doe",
    email: "john@example.com", organizationId: "org-123",
    stage: "INTAKE", isActive: true, archivedAt: null,
    updatedAt: new Date(), lastActivityAt: null,
    lastDisputeSnapshot: null,
    _count: { reports: 1, disputes: 2, accounts: 3 },
    reports: [], disputes: [], accounts: [],
    ...overrides,
  };
}

describe("/api/clients/[id]", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetServerSession.mockReset(); });

  describe("GET", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { GET } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", headers: new Map() } as any;
      const res = await GET(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(401);
    });

    it("returns specific client for authenticated user", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      const client = mockClient();
      mockPrisma.client.findFirst.mockResolvedValue(client as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([] as never);
      const { GET } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", headers: new Map() } as any;
      const res = await GET(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.client).toBeDefined();
      expect(body.summary).toBeDefined();
    });

    it("returns 404 for non-existent client", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.findFirst.mockResolvedValue(null as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([] as never);
      const { GET } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/nonexistent", headers: new Map() } as any;
      const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
      expect(res.status).toBe(404);
    });

    it("enforces org isolation", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ organizationId: "org-other" }));
      mockPrisma.client.findFirst.mockResolvedValue(null as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([] as never);
      const { GET } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", headers: new Map() } as any;
      const res = await GET(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(404);
      expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-other" }) })
      );
    });
  });

  describe("PATCH", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { PATCH } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", json: jest.fn().mockResolvedValue({} as never), headers: new Map() } as any;
      const res = await PATCH(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(401);
    });

    it("updates client with valid data", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.findFirst.mockResolvedValue(mockClient() as never);
      const updated = { ...mockClient(), firstName: "Jane" };
      mockPrisma.client.update.mockResolvedValue(updated as never);
      const { PATCH } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", json: jest.fn().mockResolvedValue({ firstName: "Jane" } as never), headers: new Map() } as any;
      const res = await PATCH(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.firstName).toBe("Jane");
    });

    it("returns 404 when client not found", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.findFirst.mockResolvedValue(null as never);
      const { PATCH } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/nonexistent", json: jest.fn().mockResolvedValue({ firstName: "Jane" } as never), headers: new Map() } as any;
      const res = await PATCH(req, { params: Promise.resolve({ id: "nonexistent" }) });
      expect(res.status).toBe(404);
    });

    it("enforces org isolation on update", async () => {
      mockGetServerSession.mockResolvedValue(createSession({ organizationId: "org-other" }));
      mockPrisma.client.findFirst.mockResolvedValue(null as never);
      const { PATCH } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", json: jest.fn().mockResolvedValue({ firstName: "Jane" } as never), headers: new Map() } as any;
      const res = await PATCH(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { DELETE } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", headers: new Map() } as any;
      const res = await DELETE(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 404 for non-existent client", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.findFirst.mockResolvedValue(null as never);
      const { DELETE } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/nonexistent", headers: new Map() } as any;
      const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent" }) });
      expect(res.status).toBe(404);
    });

    it("soft-deletes (archives) client by default", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.findFirst.mockResolvedValue(mockClient() as never);
      const { DELETE } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1", headers: new Map() } as any;
      const res = await DELETE(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.archived).toBe(true);
      expect(body.retentionDays).toBe(90);
    });

    it("permanently deletes client when permanent=true", async () => {
      mockGetServerSession.mockResolvedValue(createSession());
      mockPrisma.client.findFirst.mockResolvedValue(mockClient() as never);
      mockPrisma.creditReport.findMany.mockResolvedValue([] as never);
      mockPrisma.client.delete.mockResolvedValue({} as never);
      const { DELETE } = await import("@/app/api/clients/[id]/route");
      const req = { url: "http://localhost/api/clients/client-1?permanent=true", headers: new Map() } as any;
      const res = await DELETE(req, { params: Promise.resolve({ id: "client-1" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permanent).toBe(true);
      expect(mockPrisma.client.delete).toHaveBeenCalled();
    });
  });
});
