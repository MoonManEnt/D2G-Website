/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";

// Mock logger first to prevent pino import issues
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
  creditReport: {
    count: jest.fn().mockResolvedValue(0 as never),
    findMany: jest.fn().mockResolvedValue([] as never),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn().mockResolvedValue({} as never),
  },
  storedFile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn().mockResolvedValue({} as never),
  },
  client: {
    count: jest.fn().mockResolvedValue(0 as never),
    findFirst: jest.fn(),
  },
  dispute: { count: jest.fn().mockResolvedValue(0 as never) },
  document: { count: jest.fn().mockResolvedValue(0 as never) },
  eventLog: { create: jest.fn().mockResolvedValue({} as never) },
  diffResult: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  accountItem: { findMany: jest.fn().mockResolvedValue([] as never) },
  disputeItem: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  evidence: { deleteMany: jest.fn().mockResolvedValue({} as never) },
  $transaction: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

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

jest.mock("@/lib/report-parser", () => ({
  parseAndAnalyzeReport: jest.fn().mockResolvedValue({
    success: true, accountsParsed: 5, pageCount: 12, issuesSummary: { total: 3 },
  } as never),
}));

jest.mock("uuid", () => ({ v4: jest.fn().mockReturnValue("mock-uuid-file-id") }));

const mockDel = jest.fn().mockResolvedValue(undefined as never);
jest.mock("@vercel/blob", () => ({ del: mockDel }));

import { NextRequest } from "next/server";
import { SubscriptionTier } from "@/types";

let ListReports: any, CreateReport: any, DeleteReport: any;
beforeAll(async () => {
  const reportsMod = await import("@/app/api/reports/route");
  ListReports = reportsMod.GET;
  CreateReport = reportsMod.POST;
  const deleteReportMod = await import("@/app/api/reports/[id]/route");
  DeleteReport = deleteReportMod.DELETE;
});

function createMockSession(overrides?: Partial<any>) {
  return {
    user: {
      id: "user-123", email: "test@example.com", name: "Test User", role: "ADMIN",
      organizationId: "org-123", organizationName: "Test Org",
      subscriptionTier: SubscriptionTier.PROFESSIONAL, subscriptionStatus: "ACTIVE",
      ...overrides,
    },
  };
}

describe("API /api/reports", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetServerSession.mockReset(); });

  describe("GET /api/reports", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/reports");
      const res = await ListReports(req, undefined);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns reports for authenticated user", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      const mockReports = [
        { id: "report-1", reportDate: new Date("2025-01-15"), sourceType: "IDENTITYIQ", parseStatus: "COMPLETED", organizationId: "org-123", clientId: "client-1", client: { firstName: "Jane", lastName: "Smith" }, _count: { accounts: 12 } },
        { id: "report-2", reportDate: new Date("2025-01-20"), sourceType: "IDENTITYIQ", parseStatus: "PENDING", organizationId: "org-123", clientId: "client-2", client: { firstName: "Bob", lastName: "Jones" }, _count: { accounts: 0 } },
      ];
      mockPrisma.creditReport.findMany.mockResolvedValue(mockReports as never);
      const req = new NextRequest("http://localhost:3000/api/reports");
      const res = await ListReports(req, undefined);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe("report-1");
    });

    it("filters reports by clientId", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.creditReport.findMany.mockResolvedValue([] as never);
      const req = new NextRequest("http://localhost:3000/api/reports?clientId=client-abc");
      await ListReports(req, undefined);
      expect(mockPrisma.creditReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-123", clientId: "client-abc" }) }));
    });

    it("does not filter by clientId when set to all", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.creditReport.findMany.mockResolvedValue([] as never);
      const req = new NextRequest("http://localhost:3000/api/reports?clientId=all");
      await ListReports(req, undefined);
      const callArgs = (mockPrisma.creditReport.findMany as any).mock.calls[0][0];
      expect(callArgs.where.clientId).toBeUndefined();
    });
  });

  describe("POST /api/reports", () => {
    const validBody = { clientId: "550e8400-e29b-41d4-a716-446655440000", blobUrl: "https://storage.example.com/report.pdf", fileName: "credit-report.pdf" };

    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/reports", { method: "POST", body: JSON.stringify(validBody) });
      const res = await CreateReport(req, undefined);
      expect(res.status).toBe(401);
    });

    it("creates a report record with valid data", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100) as never) } as never) as any;
      mockPrisma.client.findFirst.mockResolvedValue({ id: validBody.clientId, organizationId: "org-123" } as never);
      const mockStoredFile = { id: "mock-uuid-file-id", filename: "credit-report.pdf" };
      const mockReport = { id: "report-new", reportDate: new Date(), parseStatus: "PENDING", organizationId: "org-123", clientId: validBody.clientId };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          storedFile: { create: jest.fn().mockResolvedValue(mockStoredFile as never) },
          creditReport: { create: jest.fn().mockResolvedValue(mockReport as never) },
          eventLog: { create: jest.fn().mockResolvedValue({} as never) },
        });
      });
      mockPrisma.creditReport.findUnique.mockResolvedValue({ id: "report-new", parseStatus: "COMPLETED", pageCount: 12, _count: { accounts: 5 } } as never);
      const req = new NextRequest("http://localhost:3000/api/reports", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await CreateReport(req, undefined);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe("report-new");
      expect(data.accountsParsed).toBe(5);
      global.fetch = originalFetch;
    });

    it("returns 404 when client not found", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100) as never) } as never) as any;
      mockPrisma.client.findFirst.mockResolvedValue(null as never);
      const req = new NextRequest("http://localhost:3000/api/reports", { method: "POST", body: JSON.stringify(validBody), headers: { "Content-Type": "application/json" } });
      const res = await CreateReport(req, undefined);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Client not found");
      global.fetch = originalFetch;
    });
  });

  describe("DELETE /api/reports/[id]", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/reports/report-1", { method: "DELETE" });
      const res = await DeleteReport(req, { params: Promise.resolve({ id: "report-1" }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when report not found", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.creditReport.findUnique.mockResolvedValue(null as never);
      const req = new NextRequest("http://localhost:3000/api/reports/nonexistent", { method: "DELETE" });
      const res = await DeleteReport(req, { params: Promise.resolve({ id: "nonexistent" }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Report not found");
    });

    it("returns 403 when report belongs to different org", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.creditReport.findUnique.mockResolvedValue({ id: "report-other", organizationId: "org-OTHER", originalFile: null, originalFileId: null } as never);
      const req = new NextRequest("http://localhost:3000/api/reports/report-other", { method: "DELETE" });
      const res = await DeleteReport(req, { params: Promise.resolve({ id: "report-other" }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("deletes report and associated data successfully", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.creditReport.findUnique.mockResolvedValue({ id: "report-del", organizationId: "org-123", originalFile: { id: "file-1", storagePath: "/local/path.pdf", filename: "report.pdf" }, originalFileId: "file-1" } as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([{ id: "acc-1" }, { id: "acc-2" }] as never);
      mockPrisma.storedFile.findUnique.mockResolvedValue({ id: "file-1" } as never);
      const req = new NextRequest("http://localhost:3000/api/reports/report-del", { method: "DELETE" });
      const res = await DeleteReport(req, { params: Promise.resolve({ id: "report-del" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockPrisma.diffResult.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.disputeItem.deleteMany).toHaveBeenCalledWith({ where: { accountItemId: { in: ["acc-1", "acc-2"] } } });
      expect(mockPrisma.evidence.deleteMany).toHaveBeenCalledWith({ where: { accountItemId: { in: ["acc-1", "acc-2"] } } });
      expect(mockPrisma.creditReport.delete).toHaveBeenCalledWith({ where: { id: "report-del" } });
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "REPORT_DELETED", targetId: "report-del" }) }));
    });

    it("deletes blob file when storage path is a URL", async () => {
      mockGetServerSession.mockResolvedValue(createMockSession());
      mockPrisma.creditReport.findUnique.mockResolvedValue({ id: "report-blob", organizationId: "org-123", originalFile: { id: "file-blob", storagePath: "https://blob.vercel.com/some-file.pdf", filename: "cloud-report.pdf" }, originalFileId: "file-blob" } as never);
      mockPrisma.accountItem.findMany.mockResolvedValue([] as never);
      mockPrisma.storedFile.findUnique.mockResolvedValue({ id: "file-blob" } as never);
      const req = new NextRequest("http://localhost:3000/api/reports/report-blob", { method: "DELETE" });
      const res = await DeleteReport(req, { params: Promise.resolve({ id: "report-blob" }) });
      expect(res.status).toBe(200);
      expect(mockDel).toHaveBeenCalledWith("https://blob.vercel.com/some-file.pdf");
    });
  });
});
