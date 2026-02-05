/**
 * SENTRY E-OSCAR ENGINE TESTS
 *
 * Tests for the e-OSCAR dispute code recommendation engine
 * Based on CFPB Circular 2022-07 and Federal Reserve FCRA guidance
 */

import {
  EOSCAR_CODE_DATABASE,
  getEOSCARCode,
  getCodesForFlow,
  codesConflict,
  recommendCodesForAccount,
  validateCodeSelection,
  getCodesByPriority,
  METRO2_COMPLIANCE_CODES,
  ACDV_RESPONSE_CODES,
  isSuccessfulResponse,
  getFavorableResponseCodes,
  getMetro2DisputeCode,
} from "@/lib/sentry/eoscar-engine";
import type { SentryAccountItem } from "@/types/sentry";

describe("e-OSCAR Code Database", () => {
  it("should have comprehensive code database (27+ codes)", () => {
    expect(EOSCAR_CODE_DATABASE.length).toBeGreaterThanOrEqual(27);
  });

  it("should have all required identity/fraud codes", () => {
    const identityCodes = ["001", "002", "103", "104"];
    identityCodes.forEach((code) => {
      const found = getEOSCARCode(code);
      expect(found).toBeDefined();
      expect(found?.priority).toBe("HIGH");
    });
  });

  it("should have all accuracy codes", () => {
    const accuracyCodes = ["105", "106", "107", "108", "109"];
    accuracyCodes.forEach((code) => {
      expect(getEOSCARCode(code)).toBeDefined();
    });
  });

  it("should have bankruptcy-related codes", () => {
    const bankruptcyCodes = ["019", "037", "102"];
    bankruptcyCodes.forEach((code) => {
      expect(getEOSCARCode(code)).toBeDefined();
    });
  });

  it("should have special circumstance codes", () => {
    const specialCodes = ["038", "039", "040", "041"];
    specialCodes.forEach((code) => {
      expect(getEOSCARCode(code)).toBeDefined();
    });
  });

  it("should have military code with SCRA reference", () => {
    const militaryCode = getEOSCARCode("038");
    expect(militaryCode).toBeDefined();
    expect(militaryCode?.name).toContain("military");
    expect(militaryCode?.triggerConditions).toContain("scra_protection");
    expect(militaryCode?.historicalSuccessRate).toBeGreaterThan(0.6); // High due to SCRA
  });

  it("should have disaster victim code", () => {
    const disasterCode = getEOSCARCode("041");
    expect(disasterCode).toBeDefined();
    expect(disasterCode?.triggerConditions).toContain("natural_disaster");
    expect(disasterCode?.triggerConditions).toContain("fema_disaster");
  });

  it("should have generic code 112 with lowest success rate", () => {
    const genericCode = getEOSCARCode("112");
    expect(genericCode).toBeDefined();
    expect(genericCode?.priority).toBe("LOW");
    expect(genericCode?.historicalSuccessRate).toBeLessThan(0.2);
  });
});

describe("Code Conflict Detection", () => {
  it("should detect conflict between identity and payment codes", () => {
    // Can't dispute payment history on an account you claim isn't yours
    expect(codesConflict("001", "106")).toBe(true);
    expect(codesConflict("103", "106")).toBe(true);
  });

  it("should not flag non-conflicting codes", () => {
    expect(codesConflict("105", "106")).toBe(false); // dates vs payments - both valid
    expect(codesConflict("105", "109")).toBe(false); // dates vs balance - both valid
  });

  it("should detect bankruptcy code conflicts", () => {
    // Can't be both included and excluded from bankruptcy
    expect(codesConflict("037", "102")).toBe(true);
  });
});

describe("Flow-Based Code Filtering", () => {
  it("should return identity codes for CONSENT flow", () => {
    const codes = getCodesForFlow("CONSENT");
    const codeCodes = codes.map((c) => c.code);
    expect(codeCodes).toContain("001");
    expect(codeCodes).toContain("103");
    expect(codeCodes).toContain("104");
    expect(codeCodes).not.toContain("112"); // Generic should never be included
  });

  it("should return collection codes for COLLECTION flow", () => {
    const codes = getCodesForFlow("COLLECTION");
    const codeCodes = codes.map((c) => c.code);
    expect(codeCodes).toContain("006");
    expect(codeCodes).toContain("012");
    expect(codeCodes).toContain("037"); // bankruptcy
    expect(codeCodes).not.toContain("112");
  });

  it("should return accuracy codes for ACCURACY flow", () => {
    const codes = getCodesForFlow("ACCURACY");
    const codeCodes = codes.map((c) => c.code);
    expect(codeCodes).toContain("105");
    expect(codeCodes).toContain("106");
    expect(codeCodes).toContain("109");
    expect(codeCodes).not.toContain("112");
  });

  it("should return all codes except 112 for COMBO flow", () => {
    const codes = getCodesForFlow("COMBO");
    const codeCodes = codes.map((c) => c.code);
    expect(codeCodes).not.toContain("112");
    expect(codes.length).toBeGreaterThanOrEqual(26);
  });
});

describe("Code Recommendations", () => {
  it("should recommend balance code for balance issues", () => {
    const account: SentryAccountItem = {
      id: "test-1",
      creditorName: "Test Creditor",
      cra: "TRANSUNION",
      detectedIssues: [
        {
          code: "balance_wrong",
          severity: "HIGH",
          description: "Balance discrepancy across bureaus",
        },
      ],
    };

    const recommendations = recommendCodesForAccount(account, "ACCURACY");
    expect(recommendations.length).toBeGreaterThan(0);
    // Code 109 (balance) should be recommended
    const hasBalanceCode = recommendations.some((r) => r.code.code === "109");
    expect(hasBalanceCode).toBe(true);
  });

  it("should never recommend generic code 112 when issues exist", () => {
    const account: SentryAccountItem = {
      id: "test-2",
      creditorName: "Test Creditor",
      cra: "EQUIFAX",
      detectedIssues: [
        {
          code: "date_discrepancy",
          severity: "MEDIUM",
          description: "Date opened incorrect",
        },
      ],
    };

    const recommendations = recommendCodesForAccount(account, "ACCURACY");
    const has112 = recommendations.some((r) => r.code.code === "112");
    expect(has112).toBe(false);
  });

  it("should prioritize high-value codes", () => {
    const account: SentryAccountItem = {
      id: "test-3",
      creditorName: "Collection Agency",
      cra: "EXPERIAN",
      accountType: "COLLECTION",
      isCollection: true,
      detectedIssues: [
        {
          code: "no_dunning_letter",
          severity: "HIGH",
          description: "Never received validation notice",
        },
      ],
    };

    const recommendations = recommendCodesForAccount(account, "COLLECTION");
    expect(recommendations.length).toBeGreaterThan(0);
    // First recommendation should be high priority
    expect(["HIGH", "MEDIUM"]).toContain(recommendations[0].code.priority);
  });
});

describe("Code Selection Validation", () => {
  it("should validate non-conflicting code selections", () => {
    const result = validateCodeSelection(["105", "106", "109"]);
    expect(result.isValid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("should detect conflicting code selections", () => {
    const result = validateCodeSelection(["001", "106"]); // identity vs payment
    expect(result.isValid).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});

describe("Priority Filtering", () => {
  it("should return high priority codes", () => {
    const highCodes = getCodesByPriority("HIGH");
    expect(highCodes.length).toBeGreaterThan(5);
    highCodes.forEach((c) => expect(c.priority).toBe("HIGH"));
  });

  it("should include military and disaster in high priority", () => {
    const highCodes = getCodesByPriority("HIGH");
    const codeCodes = highCodes.map((c) => c.code);
    expect(codeCodes).toContain("038"); // military
    expect(codeCodes).toContain("041"); // disaster
  });
});

describe("Metro 2 Compliance Codes", () => {
  it("should have all standard compliance codes", () => {
    expect(METRO2_COMPLIANCE_CODES.length).toBe(6);
    const codes = METRO2_COMPLIANCE_CODES.map((c) => c.code);
    expect(codes).toContain("XB");
    expect(codes).toContain("XC");
    expect(codes).toContain("XH");
    expect(codes).toContain("XR");
  });

  it("should return correct dispute status code", () => {
    expect(getMetro2DisputeCode(true, false, false)).toBe("XB"); // In progress
    expect(getMetro2DisputeCode(false, true, true)).toBe("XC"); // Complete, disagrees
    expect(getMetro2DisputeCode(false, true, false)).toBe("XH"); // Resolved
  });
});

describe("ACDV Response Codes", () => {
  it("should have response codes", () => {
    expect(ACDV_RESPONSE_CODES.length).toBeGreaterThanOrEqual(9);
  });

  it("should identify favorable responses", () => {
    expect(isSuccessfulResponse("01")).toBe(true); // Deleted
    expect(isSuccessfulResponse("02")).toBe(true); // Modified
    expect(isSuccessfulResponse("05")).toBe(true); // No record
    expect(isSuccessfulResponse("13")).toBe(true); // Deleted per policy
  });

  it("should identify unfavorable responses", () => {
    expect(isSuccessfulResponse("03")).toBe(false); // Verified as reported
    expect(isSuccessfulResponse("12")).toBe(false); // Accurate due to activity
  });

  it("should return all favorable codes", () => {
    const favorable = getFavorableResponseCodes();
    expect(favorable).toContain("01");
    expect(favorable).toContain("02");
    expect(favorable).toContain("05");
    expect(favorable).not.toContain("03");
  });
});

describe("Historical Success Rates", () => {
  it("should have success rates for all codes", () => {
    EOSCAR_CODE_DATABASE.forEach((code) => {
      expect(code.historicalSuccessRate).toBeDefined();
      expect(code.historicalSuccessRate).toBeGreaterThanOrEqual(0);
      expect(code.historicalSuccessRate).toBeLessThanOrEqual(1);
    });
  });

  it("should have higher success for SCRA/disaster codes", () => {
    const militaryCode = getEOSCARCode("038");
    const disasterCode = getEOSCARCode("041");
    const genericCode = getEOSCARCode("112");

    expect(militaryCode?.historicalSuccessRate).toBeGreaterThan(
      genericCode?.historicalSuccessRate || 0
    );
    expect(disasterCode?.historicalSuccessRate).toBeGreaterThan(
      genericCode?.historicalSuccessRate || 0
    );
  });
});
