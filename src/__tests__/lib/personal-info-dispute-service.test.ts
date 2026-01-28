import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// =============================================================================
// MOCKS
// =============================================================================

const mockPrisma = {
  personalInfoDispute: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  dispute: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  getActiveDisputes,
  getLastDisputeDate,
  recordDisputedItems,
  compareReportAndUpdateDisputes,
  getDisputeHistorySummary,
} from "@/lib/personal-info-dispute-service";
import type { ActivePersonalInfoDispute } from "@/lib/personal-info-dispute-service";

// =============================================================================
// TESTS
// =============================================================================

describe("Personal Info Dispute Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getActiveDisputes()", () => {
    it("returns active disputes for a client/CRA", async () => {
      const mockDisputes = [
        {
          id: "pid-1",
          clientId: "client-1",
          type: "PREVIOUS_NAME",
          value: "John Q Doe",
          cra: "TRANSUNION",
          status: "ACTIVE",
          inquiryDate: null,
          disputeCount: 2,
          firstDisputedAt: new Date("2025-01-01"),
        },
        {
          id: "pid-2",
          clientId: "client-1",
          type: "HARD_INQUIRY",
          value: "Capital One",
          cra: "TRANSUNION",
          status: "ACTIVE",
          inquiryDate: "01/10/2025",
          disputeCount: 1,
          firstDisputedAt: new Date("2025-01-15"),
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(mockDisputes as never);

      const result = await getActiveDisputes("client-1", "TRANSUNION" as any);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("PREVIOUS_NAME");
      expect(result[0].value).toBe("John Q Doe");
      expect(result[0].disputeCount).toBe(2);
      expect(result[1].type).toBe("HARD_INQUIRY");
      expect(result[1].value).toBe("Capital One");
      expect(result[1].inquiryDate).toBe("01/10/2025");
    });

    it("returns empty array when no active disputes exist", async () => {
      mockPrisma.personalInfoDispute.findMany.mockResolvedValue([] as never);

      const result = await getActiveDisputes("client-1", "TRANSUNION" as any);

      expect(result).toEqual([]);
    });

    it("queries with correct filters (clientId, cra, ACTIVE status)", async () => {
      mockPrisma.personalInfoDispute.findMany.mockResolvedValue([] as never);

      await getActiveDisputes("client-42", "EXPERIAN" as any);

      expect(mockPrisma.personalInfoDispute.findMany).toHaveBeenCalledWith({
        where: {
          clientId: "client-42",
          cra: "EXPERIAN",
          status: "ACTIVE",
        },
        orderBy: { firstDisputedAt: "asc" },
      });
    });

    it("maps dispute data correctly", async () => {
      const mockData = [
        {
          id: "pid-3",
          clientId: "client-1",
          type: "PREVIOUS_ADDRESS",
          value: "123 Old Street, Austin TX",
          cra: "EQUIFAX",
          status: "ACTIVE",
          inquiryDate: null,
          disputeCount: 3,
          firstDisputedAt: new Date("2024-06-15"),
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(mockData as never);

      const result = await getActiveDisputes("client-1", "EQUIFAX" as any);

      expect(result[0]).toEqual({
        type: "PREVIOUS_ADDRESS",
        value: "123 Old Street, Austin TX",
        cra: "EQUIFAX",
        inquiryDate: undefined,
        disputeCount: 3,
        firstDisputedAt: new Date("2024-06-15"),
      });
    });
  });

  describe("getLastDisputeDate()", () => {
    it("returns the date of the most recent sent dispute", async () => {
      const date = new Date("2025-01-10T12:00:00Z");
      mockPrisma.dispute.findFirst.mockResolvedValue({ createdAt: date } as never);

      const result = await getLastDisputeDate("client-1", "TRANSUNION" as any);

      expect(result).toEqual(date);
    });

    it("returns null when no disputes exist", async () => {
      mockPrisma.dispute.findFirst.mockResolvedValue(null as never);

      const result = await getLastDisputeDate("client-1", "TRANSUNION" as any);

      expect(result).toBeNull();
    });

    it("queries with correct filters (excludes DRAFT)", async () => {
      mockPrisma.dispute.findFirst.mockResolvedValue(null as never);

      await getLastDisputeDate("client-5", "EXPERIAN" as any);

      expect(mockPrisma.dispute.findFirst).toHaveBeenCalledWith({
        where: {
          clientId: "client-5",
          cra: "EXPERIAN",
          status: { not: "DRAFT" },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
    });
  });

  describe("recordDisputedItems()", () => {
    it("creates/upserts records for previous names", async () => {
      mockPrisma.personalInfoDispute.upsert.mockResolvedValue({} as never);

      await recordDisputedItems(
        "client-1",
        "org-1",
        "TRANSUNION" as any,
        {
          previousNames: ["Jane Q Doe", "J. Doe"],
          previousAddresses: [],
          hardInquiries: [],
        }
      );

      expect(mockPrisma.personalInfoDispute.upsert).toHaveBeenCalledTimes(2);

      // Verify first name upsert
      expect(mockPrisma.personalInfoDispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clientId_type_value_cra: {
              clientId: "client-1",
              type: "PREVIOUS_NAME",
              value: "Jane Q Doe",
              cra: "TRANSUNION",
            },
          },
          create: expect.objectContaining({
            clientId: "client-1",
            organizationId: "org-1",
            type: "PREVIOUS_NAME",
            value: "Jane Q Doe",
            cra: "TRANSUNION",
            status: "ACTIVE",
            disputeCount: 1,
          }),
          update: expect.objectContaining({
            status: "ACTIVE",
            disputeCount: { increment: 1 },
          }),
        })
      );
    });

    it("creates/upserts records for previous addresses", async () => {
      mockPrisma.personalInfoDispute.upsert.mockResolvedValue({} as never);

      await recordDisputedItems(
        "client-1",
        "org-1",
        "EQUIFAX" as any,
        {
          previousNames: [],
          previousAddresses: ["456 Old Ave, Dallas TX 75201"],
          hardInquiries: [],
        }
      );

      expect(mockPrisma.personalInfoDispute.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.personalInfoDispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clientId_type_value_cra: {
              clientId: "client-1",
              type: "PREVIOUS_ADDRESS",
              value: "456 Old Ave, Dallas TX 75201",
              cra: "EQUIFAX",
            },
          },
          create: expect.objectContaining({
            type: "PREVIOUS_ADDRESS",
            value: "456 Old Ave, Dallas TX 75201",
          }),
        })
      );
    });

    it("creates/upserts records for hard inquiries matching CRA", async () => {
      mockPrisma.personalInfoDispute.upsert.mockResolvedValue({} as never);

      await recordDisputedItems(
        "client-1",
        "org-1",
        "TRANSUNION" as any,
        {
          previousNames: [],
          previousAddresses: [],
          hardInquiries: [
            { creditorName: "Capital One", inquiryDate: "01/10/2025", cra: "TRANSUNION" },
            { creditorName: "Chase Bank", inquiryDate: "02/15/2025", cra: "EXPERIAN" },
          ],
        }
      );

      // Only Capital One should be recorded (TRANSUNION matches)
      expect(mockPrisma.personalInfoDispute.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.personalInfoDispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clientId_type_value_cra: {
              clientId: "client-1",
              type: "HARD_INQUIRY",
              value: "Capital One",
              cra: "TRANSUNION",
            },
          },
          create: expect.objectContaining({
            type: "HARD_INQUIRY",
            value: "Capital One",
            inquiryDate: "01/10/2025",
          }),
        })
      );
    });

    it("skips hard inquiries that do not match the target CRA", async () => {
      mockPrisma.personalInfoDispute.upsert.mockResolvedValue({} as never);

      await recordDisputedItems(
        "client-1",
        "org-1",
        "EQUIFAX" as any,
        {
          previousNames: [],
          previousAddresses: [],
          hardInquiries: [
            { creditorName: "Capital One", inquiryDate: "01/10/2025", cra: "TRANSUNION" },
          ],
        }
      );

      // CRA mismatch: EQUIFAX vs TRANSUNION - should not upsert
      expect(mockPrisma.personalInfoDispute.upsert).not.toHaveBeenCalled();
    });

    it("handles empty items (no names, addresses, or inquiries)", async () => {
      await recordDisputedItems(
        "client-1",
        "org-1",
        "TRANSUNION" as any,
        {
          previousNames: [],
          previousAddresses: [],
          hardInquiries: [],
        }
      );

      expect(mockPrisma.personalInfoDispute.upsert).not.toHaveBeenCalled();
    });
  });

  describe("compareReportAndUpdateDisputes()", () => {
    it("marks items as REMOVED when no longer in report", async () => {
      const activeDisputes = [
        {
          id: "pid-1",
          clientId: "client-1",
          type: "PREVIOUS_NAME",
          value: "Old Name",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(activeDisputes as never);
      mockPrisma.personalInfoDispute.update.mockResolvedValue({} as never);

      const result = await compareReportAndUpdateDisputes(
        "client-1",
        "org-1",
        "report-123",
        {
          previousNames: [], // Name no longer in report
          previousAddresses: [],
          hardInquiries: [],
        }
      );

      expect(result.removedNames).toContain("Old Name");
      expect(mockPrisma.personalInfoDispute.update).toHaveBeenCalledWith({
        where: { id: "pid-1" },
        data: expect.objectContaining({
          status: "REMOVED",
          removedInReportId: "report-123",
        }),
      });
    });

    it("does NOT mark items as removed if still in report", async () => {
      const activeDisputes = [
        {
          id: "pid-1",
          clientId: "client-1",
          type: "PREVIOUS_NAME",
          value: "John Q Doe",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(activeDisputes as never);

      const result = await compareReportAndUpdateDisputes(
        "client-1",
        "org-1",
        "report-123",
        {
          previousNames: ["John Q Doe"], // Still present
          previousAddresses: [],
          hardInquiries: [],
        }
      );

      expect(result.removedNames).toHaveLength(0);
      expect(mockPrisma.personalInfoDispute.update).not.toHaveBeenCalled();
    });

    it("performs case-insensitive name comparison", async () => {
      const activeDisputes = [
        {
          id: "pid-1",
          clientId: "client-1",
          type: "PREVIOUS_NAME",
          value: "JOHN DOE",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(activeDisputes as never);

      const result = await compareReportAndUpdateDisputes(
        "client-1",
        "org-1",
        "report-123",
        {
          previousNames: ["john doe"], // Same name, different case
          previousAddresses: [],
          hardInquiries: [],
        }
      );

      // Should NOT be removed since names match (case-insensitive)
      expect(result.removedNames).toHaveLength(0);
    });

    it("normalizes addresses for comparison", async () => {
      const activeDisputes = [
        {
          id: "pid-2",
          clientId: "client-1",
          type: "PREVIOUS_ADDRESS",
          value: "123 Main Street, Dallas TX",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(activeDisputes as never);

      const result = await compareReportAndUpdateDisputes(
        "client-1",
        "org-1",
        "report-123",
        {
          previousNames: [],
          previousAddresses: ["123 Main St, Dallas TX"], // Normalized form
          hardInquiries: [],
        }
      );

      // Should NOT be removed since addresses match after normalization
      expect(result.removedAddresses).toHaveLength(0);
    });

    it("detects removed hard inquiries", async () => {
      const activeDisputes = [
        {
          id: "pid-3",
          clientId: "client-1",
          type: "HARD_INQUIRY",
          value: "Capital One",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(activeDisputes as never);
      mockPrisma.personalInfoDispute.update.mockResolvedValue({} as never);

      const result = await compareReportAndUpdateDisputes(
        "client-1",
        "org-1",
        "report-123",
        {
          previousNames: [],
          previousAddresses: [],
          hardInquiries: [], // Inquiry no longer present
        }
      );

      expect(result.removedInquiries).toContain("Capital One");
    });

    it("returns correct summary with multiple removals", async () => {
      const activeDisputes = [
        {
          id: "pid-1",
          clientId: "client-1",
          type: "PREVIOUS_NAME",
          value: "Old Name",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
        {
          id: "pid-2",
          clientId: "client-1",
          type: "PREVIOUS_ADDRESS",
          value: "999 Gone Ave",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
        {
          id: "pid-3",
          clientId: "client-1",
          type: "HARD_INQUIRY",
          value: "Removed Bank",
          cra: "TRANSUNION",
          status: "ACTIVE",
        },
      ];

      mockPrisma.personalInfoDispute.findMany.mockResolvedValue(activeDisputes as never);
      mockPrisma.personalInfoDispute.update.mockResolvedValue({} as never);

      const result = await compareReportAndUpdateDisputes(
        "client-1",
        "org-1",
        "report-123",
        {
          previousNames: [],
          previousAddresses: [],
          hardInquiries: [],
        }
      );

      expect(result.removedNames).toEqual(["Old Name"]);
      expect(result.removedAddresses).toEqual(["999 Gone Ave"]);
      expect(result.removedInquiries).toEqual(["Removed Bank"]);
      expect(mockPrisma.personalInfoDispute.update).toHaveBeenCalledTimes(3);
    });
  });

  describe("getDisputeHistorySummary()", () => {
    it("returns correct summary with stats", async () => {
      mockPrisma.dispute.count.mockResolvedValue(3 as never);
      mockPrisma.dispute.findFirst.mockResolvedValue({
        createdAt: new Date("2025-01-15"),
      } as never);
      mockPrisma.personalInfoDispute.groupBy.mockResolvedValue([
        { type: "PREVIOUS_NAME", status: "ACTIVE", _count: 2 },
        { type: "PREVIOUS_NAME", status: "REMOVED", _count: 1 },
        { type: "PREVIOUS_ADDRESS", status: "ACTIVE", _count: 3 },
        { type: "HARD_INQUIRY", status: "ACTIVE", _count: 4 },
        { type: "HARD_INQUIRY", status: "REMOVED", _count: 2 },
      ] as never);

      const result = await getDisputeHistorySummary("client-1", "TRANSUNION" as any);

      expect(result.totalRounds).toBe(3);
      expect(result.lastDisputeDate).toEqual(new Date("2025-01-15"));
      expect(result.personalInfoStats.activeNames).toBe(2);
      expect(result.personalInfoStats.removedNames).toBe(1);
      expect(result.personalInfoStats.activeAddresses).toBe(3);
      expect(result.personalInfoStats.removedAddresses).toBe(0);
      expect(result.personalInfoStats.activeInquiries).toBe(4);
      expect(result.personalInfoStats.removedInquiries).toBe(2);
    });

    it("returns null lastDisputeDate when no disputes exist", async () => {
      mockPrisma.dispute.count.mockResolvedValue(0 as never);
      mockPrisma.dispute.findFirst.mockResolvedValue(null as never);
      mockPrisma.personalInfoDispute.groupBy.mockResolvedValue([] as never);

      const result = await getDisputeHistorySummary("client-1", "TRANSUNION" as any);

      expect(result.totalRounds).toBe(0);
      expect(result.lastDisputeDate).toBeNull();
      expect(result.personalInfoStats.activeNames).toBe(0);
      expect(result.personalInfoStats.removedNames).toBe(0);
    });
  });
});
