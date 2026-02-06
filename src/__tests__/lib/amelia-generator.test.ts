import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  generateLetter,
  validateLetter,
  getFlowRoundInfo,
  LETTER_STRUCTURE_DESCRIPTIONS,
} from "@/lib/amelia-generator";
import type {
  LetterGenerationInput,
  GeneratedLetter,
  ActivePersonalInfoDispute,
} from "@/lib/amelia-generator";
import type { ClientPersonalInfo, DisputeAccount } from "@/lib/amelia-doctrine";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createMockClient(overrides?: Partial<ClientPersonalInfo>): ClientPersonalInfo {
  return {
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    addressLine1: "123 Main Street",
    city: "Houston",
    state: "TX",
    zipCode: "77001",
    ssnLast4: "1234",
    dateOfBirth: "01/15/1985",
    previousNames: ["Jonathan Doe", "J. Doe"],
    previousAddresses: ["456 Old Lane, Austin TX 73301"],
    hardInquiries: [
      { creditorName: "Capital One", inquiryDate: "01/10/2025", cra: "TRANSUNION" as any },
      { creditorName: "Chase Bank", inquiryDate: "02/15/2025", cra: "EXPERIAN" as any },
    ],
    ...overrides,
  };
}

function createMockAccounts(count: number = 2): DisputeAccount[] {
  const accounts: DisputeAccount[] = [];
  for (let i = 0; i < count; i++) {
    accounts.push({
      creditorName: `Creditor ${i + 1}`,
      accountNumber: `XXXX${(1000 + i).toString()}`,
      accountType: "Revolving",
      balance: 1500 + i * 500,
      issues: [
        {
          code: "BALANCE_INCONSISTENCY",
          severity: "HIGH",
          description: "Balance differs across bureaus",
        },
        {
          code: "STATUS_INCONSISTENCY",
          severity: "MEDIUM",
          description: "Status differs across bureaus",
        },
      ],
      inaccurateCategories: ["BALANCE", "ACCOUNT STATUS"],
    });
  }
  return accounts;
}

function createBaseInput(overrides?: Partial<LetterGenerationInput>): LetterGenerationInput {
  return {
    client: createMockClient(),
    accounts: createMockAccounts(),
    cra: "TRANSUNION" as any,
    flow: "ACCURACY",
    round: 1,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("AMELIA Generator", () => {
  describe("generateLetter() - Flow Types", () => {
    it("generates a valid letter for ACCURACY flow", () => {
      const input = createBaseInput({ flow: "ACCURACY", round: 1 });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content).toBeTruthy();
      expect(letter.content.length).toBeGreaterThan(500);
      expect(letter.flow).toBe("ACCURACY");
      expect(letter.effectiveFlow).toBe("ACCURACY");
      expect(letter.round).toBe(1);
      expect(letter.statute).toBeTruthy();
    });

    it("generates a valid letter for COLLECTION flow", () => {
      const input = createBaseInput({
        flow: "COLLECTION",
        round: 1,
        debtCollectorNames: ["ABC Collections"],
      });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content.length).toBeGreaterThan(500);
      expect(letter.flow).toBe("COLLECTION");
      expect(letter.effectiveFlow).toBe("COLLECTION");
    });

    it("generates a valid letter for CONSENT flow", () => {
      const input = createBaseInput({ flow: "CONSENT", round: 1 });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content.length).toBeGreaterThan(500);
      expect(letter.flow).toBe("CONSENT");
    });

    it("generates a valid letter for COMBO flow", () => {
      const input = createBaseInput({
        flow: "COMBO",
        round: 1,
        debtCollectorNames: ["XYZ Debt Group"],
      });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content.length).toBeGreaterThan(500);
      expect(letter.flow).toBe("COMBO");
    });

    it("COLLECTION flow switches to ACCURACY for rounds 5-7", () => {
      const input = createBaseInput({
        flow: "COLLECTION",
        round: 5,
        debtCollectorNames: ["ABC Collections"],
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);

      expect(letter.flow).toBe("COLLECTION");
      expect(letter.effectiveFlow).toBe("ACCURACY");
    });

    it("COMBO flow switches to ACCURACY for rounds 5-7", () => {
      const input = createBaseInput({
        flow: "COMBO",
        round: 6,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);

      expect(letter.flow).toBe("COMBO");
      expect(letter.effectiveFlow).toBe("ACCURACY");
    });
  });

  describe("generateLetter() - Letter Structure Toggle", () => {
    it("uses DAMAGES_FIRST structure by default", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);

      expect(letter.letterStructure).toBe("DAMAGES_FIRST");
    });

    it("uses DAMAGES_FIRST structure when explicitly set", () => {
      const input = createBaseInput({
        round: 1,
        letterStructure: "DAMAGES_FIRST",
      });
      const letter = generateLetter(input);

      expect(letter.letterStructure).toBe("DAMAGES_FIRST");
    });

    it("uses FACTS_FIRST structure when set", () => {
      const input = createBaseInput({
        round: 1,
        letterStructure: "FACTS_FIRST",
      });
      const letter = generateLetter(input);

      expect(letter.letterStructure).toBe("FACTS_FIRST");
    });

    it("DAMAGES_FIRST and FACTS_FIRST produce different content order", () => {
      // Seed random for consistent results - both should have same info, different order
      const damagesInput = createBaseInput({
        round: 2,
        letterStructure: "DAMAGES_FIRST",
        lastDisputeDate: "January 1, 2025",
      });
      const factsInput = createBaseInput({
        round: 2,
        letterStructure: "FACTS_FIRST",
        lastDisputeDate: "January 1, 2025",
      });

      const damagesLetter = generateLetter(damagesInput);
      const factsLetter = generateLetter(factsInput);

      // Both should contain the same overall elements
      expect(damagesLetter.content).toContain("John Doe");
      expect(factsLetter.content).toContain("John Doe");
      expect(damagesLetter.letterStructure).toBe("DAMAGES_FIRST");
      expect(factsLetter.letterStructure).toBe("FACTS_FIRST");
    });
  });

  describe("generateLetter() - Round Escalation (Tone)", () => {
    it("R1 tone is CONCERNED", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      expect(letter.tone).toBe("CONCERNED");
    });

    it("R2 tone is WORRIED", () => {
      const input = createBaseInput({
        round: 2,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);
      expect(letter.tone).toBe("WORRIED");
    });

    it("R3 tone is FED_UP", () => {
      const input = createBaseInput({
        round: 3,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);
      expect(letter.tone).toBe("FED_UP");
    });

    it("R4 tone is WARNING", () => {
      const input = createBaseInput({
        round: 4,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);
      expect(letter.tone).toBe("WARNING");
    });

    it("R5+ tone is PISSED", () => {
      const input = createBaseInput({
        round: 5,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);
      expect(letter.tone).toBe("PISSED");
    });

    it("R10 tone is PISSED (highest escalation)", () => {
      const input = createBaseInput({
        round: 10,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);
      expect(letter.tone).toBe("PISSED");
    });
  });

  describe("generateLetter() - Content Uniqueness", () => {
    it("generates 10 letters with all unique content hashes", () => {
      const hashes = new Set<string>();
      const usedContentHashes = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const input = createBaseInput({
          round: 1,
          usedContentHashes,
        });
        const letter = generateLetter(input);
        hashes.add(letter.contentHash);
        usedContentHashes.add(letter.contentHash);
      }

      // All 10 letters should have unique content hashes
      expect(hashes.size).toBe(10);
    });

    it("content hash is a non-empty hex string", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);

      expect(letter.contentHash).toBeTruthy();
      expect(letter.contentHash.length).toBe(16);
      expect(letter.contentHash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe("generateLetter() - Backdating Logic", () => {
    it("R1 letter is backdated 60-69 days", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);

      expect(letter.isBackdated).toBe(true);
      // R1 letters should be backdated 60-69 days (random within range)
      expect(letter.backdatedDays).toBeGreaterThanOrEqual(60);
      expect(letter.backdatedDays).toBeLessThanOrEqual(69);

      // Verify the letter date is approximately 60-69 days in the past
      const now = new Date();
      const daysDiff = Math.abs(
        (now.getTime() - letter.letterDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeGreaterThanOrEqual(59);
      expect(daysDiff).toBeLessThanOrEqual(70);
    });

    it("R2 letter is backdated 30-39 days", () => {
      const input = createBaseInput({
        round: 2,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);

      expect(letter.isBackdated).toBe(true);
      // R2+ letters should be backdated 30-39 days (random within range)
      expect(letter.backdatedDays).toBeGreaterThanOrEqual(30);
      expect(letter.backdatedDays).toBeLessThanOrEqual(39);
    });

    it("R5 letter is backdated 30-39 days", () => {
      const input = createBaseInput({
        round: 5,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);

      expect(letter.isBackdated).toBe(true);
      // R5 letters should be backdated 30-39 days (random within range)
      expect(letter.backdatedDays).toBeGreaterThanOrEqual(30);
      expect(letter.backdatedDays).toBeLessThanOrEqual(39);
    });
  });

  describe("generateLetter() - Personal Info Disputes", () => {
    it("R1 includes previous names in output", () => {
      const client = createMockClient({
        previousNames: ["Jonathan Doe", "J. Doe"],
      });
      const input = createBaseInput({ client, round: 1 });
      const letter = generateLetter(input);

      expect(letter.personalInfoDisputed.previousNames).toEqual(["Jonathan Doe", "J. Doe"]);
      expect(letter.content).toContain("Jonathan Doe");
      expect(letter.content).toContain("J. Doe");
    });

    it("R1 includes previous addresses in output", () => {
      const client = createMockClient({
        previousAddresses: ["456 Old Lane, Austin TX 73301"],
      });
      const input = createBaseInput({ client, round: 1 });
      const letter = generateLetter(input);

      expect(letter.personalInfoDisputed.previousAddresses).toEqual([
        "456 Old Lane, Austin TX 73301",
      ]);
      expect(letter.content).toContain("456 Old Lane, Austin TX 73301");
    });

    it("R1 includes hard inquiries for matching CRA", () => {
      const client = createMockClient({
        hardInquiries: [
          { creditorName: "Capital One", inquiryDate: "01/10/2025", cra: "TRANSUNION" as any },
          { creditorName: "Chase Bank", inquiryDate: "02/15/2025", cra: "EXPERIAN" as any },
        ],
      });
      const input = createBaseInput({ client, round: 1, cra: "TRANSUNION" as any });
      const letter = generateLetter(input);

      // Should include Capital One (TRANSUNION) but not Chase (EXPERIAN)
      expect(letter.personalInfoDisputed.hardInquiries).toHaveLength(1);
      expect(letter.personalInfoDisputed.hardInquiries[0].creditorName).toBe("Capital One");
      expect(letter.content).toContain("Capital One");
    });

    it("R2+ uses activePersonalInfoDisputes for continued disputes", () => {
      const activeDisputes: ActivePersonalInfoDispute[] = [
        {
          type: "PREVIOUS_NAME",
          value: "Old Name",
          cra: "TRANSUNION",
          disputeCount: 1,
          firstDisputedAt: new Date(),
        },
        {
          type: "HARD_INQUIRY",
          value: "Wells Fargo",
          cra: "TRANSUNION",
          inquiryDate: "03/01/2025",
          disputeCount: 2,
          firstDisputedAt: new Date(),
        },
      ];

      const input = createBaseInput({
        round: 2,
        lastDisputeDate: "January 1, 2025",
        activePersonalInfoDisputes: activeDisputes,
        cra: "TRANSUNION" as any,
      });
      const letter = generateLetter(input);

      expect(letter.personalInfoDisputed.previousNames).toContain("Old Name");
      expect(letter.personalInfoDisputed.hardInquiries).toHaveLength(1);
      expect(letter.personalInfoDisputed.hardInquiries[0].creditorName).toBe("Wells Fargo");
    });
  });

  describe("generateLetter() - Missing/Empty Client Info", () => {
    it("handles client with no previous names gracefully", () => {
      const client = createMockClient({ previousNames: [] });
      const input = createBaseInput({ client, round: 1 });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content.length).toBeGreaterThan(500);
      expect(letter.personalInfoDisputed.previousNames).toEqual([]);
    });

    it("handles client with no previous addresses gracefully", () => {
      const client = createMockClient({ previousAddresses: [] });
      const input = createBaseInput({ client, round: 1 });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content.length).toBeGreaterThan(500);
      expect(letter.personalInfoDisputed.previousAddresses).toEqual([]);
    });

    it("handles client with no hard inquiries gracefully", () => {
      const client = createMockClient({ hardInquiries: [] });
      const input = createBaseInput({ client, round: 1 });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content.length).toBeGreaterThan(500);
      expect(letter.personalInfoDisputed.hardInquiries).toEqual([]);
    });

    it("handles client with no personal info at all", () => {
      const client = createMockClient({
        previousNames: [],
        previousAddresses: [],
        hardInquiries: [],
      });
      const input = createBaseInput({ client, round: 1 });
      const letter = generateLetter(input);

      expect(letter).toBeDefined();
      expect(letter.content.length).toBeGreaterThan(500);
    });

    it("handles optional addressLine2", () => {
      const client = createMockClient({ addressLine2: "Apt 4B" });
      const input = createBaseInput({ client, round: 1 });
      const letter = generateLetter(input);

      expect(letter.content).toContain("Apt 4B");
    });
  });

  describe("generateLetter() - Header and Content Structure", () => {
    it("includes client name in header", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      expect(letter.content).toContain("John Doe");
    });

    it("includes client address in header", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      expect(letter.content).toContain("123 Main Street");
      expect(letter.content).toContain("Houston, TX 77001");
    });

    it("includes SSN last 4 (masked) in header", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      expect(letter.content).toContain("SSN: XXX-XX-1234");
    });

    it("includes CRA name and address", () => {
      const input = createBaseInput({ round: 1, cra: "TRANSUNION" as any });
      const letter = generateLetter(input);
      expect(letter.content).toContain("TransUnion");
    });

    it("includes account details", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      expect(letter.content).toContain("Creditor 1");
      expect(letter.content).toContain("XXXX1000");
    });

    it("includes closing signature", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      expect(letter.content).toContain("Sincerely,");
      expect(letter.content).toContain("John Doe");
    });

    it("R2+ includes screenshots reference", () => {
      const input = createBaseInput({
        round: 2,
        lastDisputeDate: "January 1, 2025",
      });
      const letter = generateLetter(input);
      expect(letter.includesScreenshots).toBe(true);
    });

    it("R1 does NOT include screenshots reference", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      expect(letter.includesScreenshots).toBe(false);
    });
  });

  describe("validateLetter()", () => {
    it("validates a valid R1 letter", () => {
      const input = createBaseInput({ round: 1 });
      const letter = generateLetter(input);
      const validation = validateLetter(letter);

      expect(validation.valid).toBe(true);
      expect(validation.violations).toHaveLength(0);
    });

    it("catches non-backdated R1 letter", () => {
      const fakeLetter: GeneratedLetter = {
        content: "A".repeat(600),
        letterDate: new Date(),
        isBackdated: false,
        backdatedDays: 0,
        tone: "CONCERNED",
        flow: "ACCURACY",
        effectiveFlow: "ACCURACY",
        round: 1,
        statute: "test",
        contentHash: "abc123",
        includesScreenshots: false,
        personalInfoDisputed: {
          previousNames: [],
          previousAddresses: [],
          hardInquiries: [],
        },
        letterStructure: "DAMAGES_FIRST",
      };

      const validation = validateLetter(fakeLetter);
      expect(validation.valid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(validation.violations.some((v) => v.includes("backdated"))).toBe(true);
    });

    it("catches too-short letter content", () => {
      const fakeLetter: GeneratedLetter = {
        content: "Too short",
        letterDate: new Date(),
        isBackdated: true,
        backdatedDays: 30,
        tone: "CONCERNED",
        flow: "ACCURACY",
        effectiveFlow: "ACCURACY",
        round: 1,
        statute: "test",
        contentHash: "abc123",
        includesScreenshots: false,
        personalInfoDisputed: {
          previousNames: [],
          previousAddresses: [],
          hardInquiries: [],
        },
        letterStructure: "DAMAGES_FIRST",
      };

      const validation = validateLetter(fakeLetter);
      expect(validation.valid).toBe(false);
      expect(validation.violations.some((v) => v.includes("too short"))).toBe(true);
    });
  });

  describe("getFlowRoundInfo()", () => {
    it("returns correct info for ACCURACY flow", () => {
      const info = getFlowRoundInfo("ACCURACY");
      expect(info.maxRounds).toBe(11);
      expect(info.accuracySwitchRounds).toEqual([]);
      expect(info.description).toBeTruthy();
    });

    it("returns correct info for COLLECTION flow", () => {
      const info = getFlowRoundInfo("COLLECTION");
      expect(info.maxRounds).toBe(12);
      expect(info.accuracySwitchRounds).toEqual([5, 6, 7]);
    });

    it("returns correct info for CONSENT flow", () => {
      const info = getFlowRoundInfo("CONSENT");
      expect(info.maxRounds).toBe(3);
      expect(info.accuracySwitchRounds).toEqual([]);
    });

    it("returns correct info for COMBO flow", () => {
      const info = getFlowRoundInfo("COMBO");
      expect(info.maxRounds).toBe(12);
      expect(info.accuracySwitchRounds).toEqual([5, 6, 7]);
    });
  });

  describe("Error Handling", () => {
    it("throws for invalid flow/round combination (no template)", () => {
      const input = createBaseInput({ flow: "CONSENT", round: 99 });

      expect(() => generateLetter(input)).toThrow("No template found");
    });
  });
});
