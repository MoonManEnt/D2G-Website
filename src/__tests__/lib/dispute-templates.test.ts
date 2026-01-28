import { describe, it, expect } from "@jest/globals";
import {
  generateDisputeLetter,
  getDisputeReasonFromIssueCode,
  FCRA_SECTIONS,
  CRA_ADDRESSES,
} from "@/lib/dispute-templates";
import type { DisputeLetterData, DisputeAccountData, AccountIssue } from "@/lib/dispute-templates";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockLetterData(overrides?: Partial<DisputeLetterData>): DisputeLetterData {
  return {
    clientName: "Jane Smith",
    clientAddress: "456 Oak Avenue",
    clientCity: "Dallas",
    clientState: "TX",
    clientZip: "75201",
    clientSSN4: "5678",
    clientDOB: "03/22/1990",
    currentDate: "January 15, 2025",
    round: 1,
    accounts: [
      {
        creditorName: "ABC Bank",
        accountNumber: "XXXX4321",
        accountType: "Revolving",
        accountStatus: "Charged Off",
        balance: "$2,500",
        pastDue: "$2,500",
        dateOpened: "03/15/2020",
        dateReported: "11/01/2024",
        paymentStatus: "Collection/Chargeoff",
        reason: "Account balance is inaccurate",
        fcraViolation: "15 U.S.C. 1681e(b) - Maximum Possible Accuracy",
        issues: [
          {
            code: "BALANCE_INCONSISTENCY",
            severity: "HIGH" as const,
            description: "Balance differs across credit bureaus",
            suggestedFlow: "ACCURACY",
          },
        ],
      },
    ],
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Dispute Templates", () => {
  describe("getDisputeReasonFromIssueCode()", () => {
    it("returns appropriate reason for DEROGATORY_CHARGEOFF", () => {
      const reason = getDisputeReasonFromIssueCode("DEROGATORY_CHARGEOFF");
      expect(reason).toContain("charge-off");
    });

    it("returns appropriate reason for DEROGATORY_COLLECTION", () => {
      const reason = getDisputeReasonFromIssueCode("DEROGATORY_COLLECTION");
      expect(reason).toContain("Collection");
    });

    it("returns appropriate reason for LATE_PAYMENT_SEVERE", () => {
      const reason = getDisputeReasonFromIssueCode("LATE_PAYMENT_SEVERE");
      expect(reason).toContain("Late payment");
    });

    it("returns appropriate reason for LATE_PAYMENT_MODERATE", () => {
      const reason = getDisputeReasonFromIssueCode("LATE_PAYMENT_MODERATE");
      expect(reason).toContain("Payment history");
    });

    it("returns appropriate reason for PAST_DUE_AMOUNT", () => {
      const reason = getDisputeReasonFromIssueCode("PAST_DUE_AMOUNT");
      expect(reason).toContain("Past due");
    });

    it("returns appropriate reason for BALANCE_INCONSISTENCY", () => {
      const reason = getDisputeReasonFromIssueCode("BALANCE_INCONSISTENCY");
      expect(reason).toContain("balance");
    });

    it("returns appropriate reason for STATUS_INCONSISTENCY", () => {
      const reason = getDisputeReasonFromIssueCode("STATUS_INCONSISTENCY");
      expect(reason).toContain("status");
    });

    it("returns appropriate reason for DATE_INCONSISTENCY", () => {
      const reason = getDisputeReasonFromIssueCode("DATE_INCONSISTENCY");
      expect(reason).toContain("date");
    });

    it("returns appropriate reason for OUTDATED_ACCOUNT", () => {
      const reason = getDisputeReasonFromIssueCode("OUTDATED_ACCOUNT");
      expect(reason).toContain("7-year");
    });

    it("returns appropriate reason for MISSING_REQUIRED_FIELDS", () => {
      const reason = getDisputeReasonFromIssueCode("MISSING_REQUIRED_FIELDS");
      expect(reason).toContain("missing");
    });

    it("returns appropriate reason for STUDENT_LOAN_STATUS", () => {
      const reason = getDisputeReasonFromIssueCode("STUDENT_LOAN_STATUS");
      expect(reason).toContain("Student loan");
    });

    it("returns appropriate reason for MEDICAL_DEBT_RESTRICTION", () => {
      const reason = getDisputeReasonFromIssueCode("MEDICAL_DEBT_RESTRICTION");
      expect(reason).toContain("Medical debt");
    });

    it("returns default reason for unknown issue code", () => {
      const reason = getDisputeReasonFromIssueCode("UNKNOWN_CODE_XYZ");
      expect(reason).toBe("Information is inaccurate and requires verification");
    });

    it("returns default reason for empty string code", () => {
      const reason = getDisputeReasonFromIssueCode("");
      expect(reason).toBe("Information is inaccurate and requires verification");
    });

    it("all known issue codes map to valid non-empty reasons", () => {
      const knownCodes = [
        "DEROGATORY_CHARGEOFF",
        "DEROGATORY_COLLECTION",
        "LATE_PAYMENT_SEVERE",
        "LATE_PAYMENT_MODERATE",
        "PAST_DUE_AMOUNT",
        "BALANCE_INCONSISTENCY",
        "STATUS_INCONSISTENCY",
        "DATE_INCONSISTENCY",
        "OUTDATED_ACCOUNT",
        "MISSING_REQUIRED_FIELDS",
        "STUDENT_LOAN_STATUS",
        "MEDICAL_DEBT_RESTRICTION",
      ];

      for (const code of knownCodes) {
        const reason = getDisputeReasonFromIssueCode(code);
        expect(reason).toBeTruthy();
        expect(reason.length).toBeGreaterThan(10);
        // Should NOT be the default reason
        expect(reason).not.toBe("Information is inaccurate and requires verification");
      }
    });
  });

  describe("FCRA_SECTIONS", () => {
    it("has all required issue code entries", () => {
      const expectedCodes = [
        "DEROGATORY_CHARGEOFF",
        "DEROGATORY_COLLECTION",
        "LATE_PAYMENT_SEVERE",
        "LATE_PAYMENT_MODERATE",
        "PAST_DUE_AMOUNT",
        "BALANCE_INCONSISTENCY",
        "STATUS_INCONSISTENCY",
        "DATE_INCONSISTENCY",
        "OUTDATED_ACCOUNT",
        "MISSING_REQUIRED_FIELDS",
        "STUDENT_LOAN_STATUS",
        "MEDICAL_DEBT_RESTRICTION",
      ];

      for (const code of expectedCodes) {
        expect(FCRA_SECTIONS[code]).toBeDefined();
      }
    });

    it("each FCRA section has section, title, and description", () => {
      for (const [code, info] of Object.entries(FCRA_SECTIONS)) {
        expect(info.section).toBeTruthy();
        expect(info.title).toBeTruthy();
        expect(info.description).toBeTruthy();
        // Section should reference U.S.C.
        expect(info.section).toContain("U.S.C.");
      }
    });

    it("BALANCE_INCONSISTENCY maps to 1681e(b)", () => {
      expect(FCRA_SECTIONS.BALANCE_INCONSISTENCY.section).toContain("1681e(b)");
    });

    it("DEROGATORY_COLLECTION maps to 1681s-2(b)", () => {
      expect(FCRA_SECTIONS.DEROGATORY_COLLECTION.section).toContain("1681s-2(b)");
    });

    it("OUTDATED_ACCOUNT maps to 1681c(a)(4)", () => {
      expect(FCRA_SECTIONS.OUTDATED_ACCOUNT.section).toContain("1681c(a)(4)");
    });
  });

  describe("CRA_ADDRESSES", () => {
    it("TRANSUNION has correct name", () => {
      expect(CRA_ADDRESSES.TRANSUNION.name).toBe("TransUnion");
    });

    it("EXPERIAN has correct name", () => {
      expect(CRA_ADDRESSES.EXPERIAN.name).toBe("Experian");
    });

    it("EQUIFAX has correct name", () => {
      expect(CRA_ADDRESSES.EQUIFAX.name).toContain("Equifax");
    });

    it("each CRA has address, city, state, zip", () => {
      for (const cra of ["TRANSUNION", "EXPERIAN", "EQUIFAX"] as const) {
        const info = CRA_ADDRESSES[cra];
        expect(info.address).toBeTruthy();
        expect(info.city).toBeTruthy();
        expect(info.state).toBeTruthy();
        expect(info.zip).toBeTruthy();
      }
    });

    it("TRANSUNION is in Chester, PA", () => {
      expect(CRA_ADDRESSES.TRANSUNION.city).toBe("Chester");
      expect(CRA_ADDRESSES.TRANSUNION.state).toBe("PA");
    });

    it("EXPERIAN is in Allen, TX", () => {
      expect(CRA_ADDRESSES.EXPERIAN.city).toBe("Allen");
      expect(CRA_ADDRESSES.EXPERIAN.state).toBe("TX");
    });

    it("EQUIFAX is in Atlanta, GA", () => {
      expect(CRA_ADDRESSES.EQUIFAX.city).toBe("Atlanta");
      expect(CRA_ADDRESSES.EQUIFAX.state).toBe("GA");
    });
  });

  describe("generateDisputeLetter()", () => {
    describe("ACCURACY flow", () => {
      it("generates R1 ACCURACY letter with correct header", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("Jane Smith");
        expect(letter).toContain("456 Oak Avenue");
        expect(letter).toContain("Dallas, TX 75201");
        expect(letter).toContain("SSN: XXX-XX-5678");
        expect(letter).toContain("DOB: 03/22/1990");
      });

      it("R1 ACCURACY letter includes CRA address", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("TransUnion");
        expect(letter).toContain("P.O. Box 2000");
        expect(letter).toContain("Chester");
      });

      it("R1 ACCURACY letter references FCRA sections", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("15 U.S.C.");
        expect(letter).toContain("1681");
      });

      it("R1 ACCURACY letter includes account details", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("ABC Bank");
        expect(letter).toContain("XXXX4321");
        expect(letter).toContain("$2,500");
      });

      it("R1 ACCURACY letter includes signature and enclosures", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("Sincerely,");
        expect(letter).toContain("Jane Smith");
        expect(letter).toContain("Enclosures:");
        expect(letter).toContain("government-issued ID");
      });
    });

    describe("COLLECTION flow", () => {
      it("generates R1 COLLECTION letter", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("EXPERIAN", data, "COLLECTION");

        expect(letter).toContain("Jane Smith");
        expect(letter).toContain("Experian");
        expect(letter).toContain("Collection");
        expect(letter).toContain("FDCPA");
      });

      it("COLLECTION letter references debt validation", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("EQUIFAX", data, "COLLECTION");

        expect(letter).toContain("1692g");
        expect(letter).toContain("validation");
      });
    });

    describe("CONSENT flow", () => {
      it("generates CONSENT letter", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "CONSENT");

        expect(letter).toContain("Jane Smith");
        expect(letter).toContain("Unauthorized");
        expect(letter).toContain("permissible purpose");
      });

      it("CONSENT letter references 1681b", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "CONSENT");

        expect(letter).toContain("1681b");
      });
    });

    describe("COMBO flow", () => {
      it("generates COMBO letter with multiple sections", () => {
        const data = createMockLetterData({
          round: 1,
          accounts: [
            {
              creditorName: "Bank A",
              accountNumber: "XXXX1111",
              balance: "$1,000",
              reason: "Inaccurate balance",
              fcraViolation: "15 U.S.C. 1681e(b)",
              issues: [
                {
                  code: "BALANCE_INCONSISTENCY",
                  severity: "HIGH" as const,
                  description: "Balance differs",
                  suggestedFlow: "ACCURACY",
                },
              ],
            },
            {
              creditorName: "Collections Corp",
              accountNumber: "XXXX2222",
              balance: "$500",
              reason: "Collection requires validation",
              fcraViolation: "15 U.S.C. 1681s-2(b)",
              issues: [
                {
                  code: "DEROGATORY_COLLECTION",
                  severity: "HIGH" as const,
                  description: "Collection account",
                  suggestedFlow: "COLLECTION",
                },
              ],
            },
          ],
        });
        const letter = generateDisputeLetter("TRANSUNION", data, "COMBO");

        expect(letter).toContain("Jane Smith");
        expect(letter).toContain("Comprehensive Dispute");
        expect(letter).toContain("ACCURACY DISPUTES");
        expect(letter).toContain("COLLECTION VALIDATION");
      });
    });

    describe("Round Escalation", () => {
      it("R2 generates Method of Verification letter", () => {
        const data = createMockLetterData({
          round: 2,
          previousDisputeDate: "December 15, 2024",
        });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("SECOND DISPUTE");
        expect(letter).toContain("Method of Verification");
        expect(letter).toContain("Round 2");
        expect(letter).toContain("December 15, 2024");
      });

      it("R3 generates Procedural Violation Notice", () => {
        const data = createMockLetterData({ round: 3 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("THIRD DISPUTE");
        expect(letter).toContain("FCRA Violations");
        expect(letter).toContain("Round 3");
        expect(letter).toContain("FINAL OPPORTUNITY");
      });

      it("R4+ generates Final Demand / Litigation letter", () => {
        const data = createMockLetterData({ round: 4 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("FINAL DEMAND BEFORE LITIGATION");
        expect(letter).toContain("LEGAL DEPARTMENT");
        expect(letter).toContain("Round 4");
        expect(letter).toContain("SETTLEMENT DEMAND");
      });

      it("R4+ includes damages calculation", () => {
        const data = createMockLetterData({ round: 5 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("DAMAGES CALCULATION");
        expect(letter).toContain("STATUTORY DAMAGES");
        // 100 * 1 account * 4 rounds = $400 minimum
        expect(letter).toContain("$400");
      });

      it("R4+ references previous rounds count", () => {
        const data = createMockLetterData({ round: 6 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("5 previous occasions");
        expect(letter).toContain("Round 6");
      });
    });

    describe("CRA-specific addresses", () => {
      it("TRANSUNION letter goes to Chester, PA", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");
        expect(letter).toContain("Chester, PA 19016-2000");
      });

      it("EXPERIAN letter goes to Allen, TX", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("EXPERIAN", data, "ACCURACY");
        expect(letter).toContain("Allen, TX 75013");
      });

      it("EQUIFAX letter goes to Atlanta, GA", () => {
        const data = createMockLetterData({ round: 1 });
        const letter = generateDisputeLetter("EQUIFAX", data, "ACCURACY");
        expect(letter).toContain("Atlanta, GA 30374-0256");
      });
    });

    describe("Account Issue Reporting", () => {
      it("includes detailed issues when present", () => {
        const data = createMockLetterData({
          accounts: [
            {
              creditorName: "Test Creditor",
              accountNumber: "XXXX9999",
              balance: "$3,000",
              reason: "Inaccurate info",
              fcraViolation: "15 U.S.C. 1681e(b)",
              issues: [
                {
                  code: "BALANCE_INCONSISTENCY",
                  severity: "HIGH" as const,
                  description: "Balance differs across credit bureaus",
                  suggestedFlow: "ACCURACY",
                },
                {
                  code: "DATE_INCONSISTENCY",
                  severity: "MEDIUM" as const,
                  description: "Date opened is incorrect",
                  suggestedFlow: "ACCURACY",
                },
              ],
            },
          ],
        });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("IDENTIFIED ISSUES:");
        expect(letter).toContain("Balance differs across credit bureaus");
        expect(letter).toContain("Date opened is incorrect");
        expect(letter).toContain("Severity: HIGH");
        expect(letter).toContain("Severity: MEDIUM");
      });

      it("includes legal basis from FCRA_SECTIONS", () => {
        const data = createMockLetterData({
          accounts: [
            {
              creditorName: "Test Creditor",
              accountNumber: "XXXX9999",
              balance: "$3,000",
              reason: "Inaccurate info",
              fcraViolation: "15 U.S.C. 1681e(b)",
              issues: [
                {
                  code: "BALANCE_INCONSISTENCY",
                  severity: "HIGH" as const,
                  description: "Balance differs",
                  suggestedFlow: "ACCURACY",
                },
              ],
            },
          ],
        });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("Legal Basis:");
        expect(letter).toContain("Maximum Possible Accuracy");
      });
    });

    describe("Optional Fields Handling", () => {
      it("handles accounts without optional fields", () => {
        const data = createMockLetterData({
          accounts: [
            {
              creditorName: "Minimal Creditor",
              accountNumber: "XXXX0000",
              balance: "$100",
              reason: "Inaccurate",
              fcraViolation: "15 U.S.C. 1681e(b)",
              // No optional fields: accountType, accountStatus, pastDue, etc.
            },
          ],
        });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("Minimal Creditor");
        expect(letter).toContain("XXXX0000");
        expect(letter).toContain("$100");
        // Should not throw
      });

      it("includes CFPB complaint number when provided", () => {
        const data = createMockLetterData({
          round: 3,
          cfpbComplaintNumber: "CFPB-2025-001234",
        });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        expect(letter).toContain("CFPB-2025-001234");
      });

      it("handles missing previousDisputeDate in R2", () => {
        const data = createMockLetterData({
          round: 2,
          // No previousDisputeDate
        });
        const letter = generateDisputeLetter("TRANSUNION", data, "ACCURACY");

        // Should not throw and should still generate letter
        expect(letter).toContain("SECOND DISPUTE");
      });
    });
  });
});
