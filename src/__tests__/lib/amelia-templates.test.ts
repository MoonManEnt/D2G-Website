import { describe, it, expect } from "@jest/globals";
import {
  ACCURACY_TEMPLATES,
  COLLECTION_TEMPLATES,
  CONSENT_TEMPLATES,
  LATE_PAYMENT_TEMPLATES,
  LETTER_STRUCTURE_DESCRIPTIONS,
  DEMAND_LANGUAGE,
  getDemandLanguage,
  getTemplate,
  shouldIncludeScreenshots,
  getEffectiveFlow,
} from "@/lib/amelia-templates";
import type { FlowType, LetterStructure, RoundTemplate } from "@/lib/amelia-templates";
import { CRA_ADDRESSES } from "@/lib/amelia-doctrine";

// =============================================================================
// TESTS
// =============================================================================

describe("AMELIA Templates", () => {
  describe("ACCURACY_TEMPLATES", () => {
    const expectedRounds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    it("has templates for all 11 rounds", () => {
      for (const round of expectedRounds) {
        expect(ACCURACY_TEMPLATES[round]).toBeDefined();
      }
    });

    it("each template has required fields", () => {
      for (const round of expectedRounds) {
        const template = ACCURACY_TEMPLATES[round];
        expect(template.headline).toBeTruthy();
        expect(template.statute).toBeTruthy();
        expect(template.openingParagraph).toBeTruthy();
        expect(template.bodyParagraphs).toBeInstanceOf(Array);
        expect(template.bodyParagraphs.length).toBeGreaterThan(0);
        expect(template.demandSection).toBeTruthy();
        expect(template.consumerStatement).toBeTruthy();
        expect(typeof template.includesScreenshots).toBe("boolean");
      }
    });

    it("R1 does not include screenshots", () => {
      expect(ACCURACY_TEMPLATES[1].includesScreenshots).toBe(false);
    });

    it("R2+ includes screenshots", () => {
      for (const round of expectedRounds.filter((r) => r >= 2)) {
        expect(ACCURACY_TEMPLATES[round].includesScreenshots).toBe(true);
      }
    });

    it("opening paragraphs contain bureau name placeholder", () => {
      // R1 should contain {bureauName} placeholder
      expect(ACCURACY_TEMPLATES[1].openingParagraph).toContain("{bureauName}");
    });

    it("each round has a statute reference", () => {
      for (const round of expectedRounds) {
        const template = ACCURACY_TEMPLATES[round];
        expect(template.statute.length).toBeGreaterThan(0);
      }
    });
  });

  describe("COLLECTION_TEMPLATES", () => {
    const expectedRounds = [1, 2, 3, 4, 8, 9, 10, 11, 12];

    it("has templates for expected rounds (1-4, 8-12)", () => {
      for (const round of expectedRounds) {
        expect(COLLECTION_TEMPLATES[round]).toBeDefined();
      }
    });

    it("does NOT have templates for rounds 5-7 (use ACCURACY)", () => {
      expect(COLLECTION_TEMPLATES[5]).toBeUndefined();
      expect(COLLECTION_TEMPLATES[6]).toBeUndefined();
      expect(COLLECTION_TEMPLATES[7]).toBeUndefined();
    });

    it("each template has required fields", () => {
      for (const round of expectedRounds) {
        const template = COLLECTION_TEMPLATES[round];
        expect(template.headline).toBeTruthy();
        expect(template.statute).toBeTruthy();
        expect(template.openingParagraph).toBeTruthy();
        expect(template.bodyParagraphs).toBeInstanceOf(Array);
        expect(template.bodyParagraphs.length).toBeGreaterThan(0);
        expect(template.consumerStatement).toBeTruthy();
      }
    });

    it("R1 references FDCPA statutes", () => {
      expect(COLLECTION_TEMPLATES[1].statute).toContain("1692");
    });

    it("R1 does not include screenshots", () => {
      expect(COLLECTION_TEMPLATES[1].includesScreenshots).toBe(false);
    });

    it("R2+ includes screenshots", () => {
      for (const round of expectedRounds.filter((r) => r >= 2)) {
        expect(COLLECTION_TEMPLATES[round].includesScreenshots).toBe(true);
      }
    });
  });

  describe("CONSENT_TEMPLATES", () => {
    const expectedRounds = [1, 2, 3];

    it("has templates for rounds 1-3", () => {
      for (const round of expectedRounds) {
        expect(CONSENT_TEMPLATES[round]).toBeDefined();
      }
    });

    it("does NOT have templates beyond round 3", () => {
      expect(CONSENT_TEMPLATES[4]).toBeUndefined();
    });

    it("each template has required fields", () => {
      for (const round of expectedRounds) {
        const template = CONSENT_TEMPLATES[round];
        expect(template.headline).toBeTruthy();
        expect(template.statute).toBeTruthy();
        expect(template.openingParagraph).toBeTruthy();
        expect(template.bodyParagraphs).toBeInstanceOf(Array);
        expect(template.bodyParagraphs.length).toBeGreaterThan(0);
        expect(template.consumerStatement).toBeTruthy();
      }
    });

    it("references permissible purpose statutes", () => {
      expect(CONSENT_TEMPLATES[1].statute).toContain("1681b");
    });
  });

  describe("LATE_PAYMENT_TEMPLATES", () => {
    const expectedRounds = [1, 2];

    it("has templates for rounds 1-2", () => {
      for (const round of expectedRounds) {
        expect(LATE_PAYMENT_TEMPLATES[round]).toBeDefined();
      }
    });

    it("each template has required fields", () => {
      for (const round of expectedRounds) {
        const template = LATE_PAYMENT_TEMPLATES[round];
        expect(template.headline).toBeTruthy();
        expect(template.statute).toBeTruthy();
        expect(template.openingParagraph).toBeTruthy();
        expect(template.bodyParagraphs).toBeInstanceOf(Array);
        expect(template.consumerStatement).toBeTruthy();
      }
    });
  });

  describe("LETTER_STRUCTURE_DESCRIPTIONS", () => {
    it("has both structure types defined", () => {
      expect(LETTER_STRUCTURE_DESCRIPTIONS.DAMAGES_FIRST).toBeDefined();
      expect(LETTER_STRUCTURE_DESCRIPTIONS.FACTS_FIRST).toBeDefined();
    });

    it("DAMAGES_FIRST has name and description", () => {
      expect(LETTER_STRUCTURE_DESCRIPTIONS.DAMAGES_FIRST.name).toBeTruthy();
      expect(LETTER_STRUCTURE_DESCRIPTIONS.DAMAGES_FIRST.description).toBeTruthy();
      expect(LETTER_STRUCTURE_DESCRIPTIONS.DAMAGES_FIRST.name).toContain("Emotional");
    });

    it("FACTS_FIRST has name and description", () => {
      expect(LETTER_STRUCTURE_DESCRIPTIONS.FACTS_FIRST.name).toBeTruthy();
      expect(LETTER_STRUCTURE_DESCRIPTIONS.FACTS_FIRST.description).toBeTruthy();
      expect(LETTER_STRUCTURE_DESCRIPTIONS.FACTS_FIRST.name).toContain("Legal");
    });
  });

  describe("DEMAND_LANGUAGE", () => {
    it("has escalation entries R1 through R7_PLUS", () => {
      expect(DEMAND_LANGUAGE.R1).toBeTruthy();
      expect(DEMAND_LANGUAGE.R2).toBeTruthy();
      expect(DEMAND_LANGUAGE.R3).toBeTruthy();
      expect(DEMAND_LANGUAGE.R4).toBeTruthy();
      expect(DEMAND_LANGUAGE.R5).toBeTruthy();
      expect(DEMAND_LANGUAGE.R6).toBeTruthy();
      expect(DEMAND_LANGUAGE.R7_PLUS).toBeTruthy();
    });

    it("R1 is polite (contains 'ask' or 'please')", () => {
      expect(
        DEMAND_LANGUAGE.R1.toLowerCase().includes("ask") ||
          DEMAND_LANGUAGE.R1.toLowerCase().includes("please")
      ).toBe(true);
    });

    it("R7_PLUS is demanding (contains 'demand')", () => {
      expect(DEMAND_LANGUAGE.R7_PLUS.toLowerCase()).toContain("demand");
    });
  });

  describe("getDemandLanguage()", () => {
    it("returns R1 language for round 1", () => {
      expect(getDemandLanguage(1)).toBe(DEMAND_LANGUAGE.R1);
    });

    it("returns R2 language for round 2", () => {
      expect(getDemandLanguage(2)).toBe(DEMAND_LANGUAGE.R2);
    });

    it("returns R3 language for round 3", () => {
      expect(getDemandLanguage(3)).toBe(DEMAND_LANGUAGE.R3);
    });

    it("returns R4 language for round 4", () => {
      expect(getDemandLanguage(4)).toBe(DEMAND_LANGUAGE.R4);
    });

    it("returns R5 language for round 5", () => {
      expect(getDemandLanguage(5)).toBe(DEMAND_LANGUAGE.R5);
    });

    it("returns R6 language for round 6", () => {
      expect(getDemandLanguage(6)).toBe(DEMAND_LANGUAGE.R6);
    });

    it("returns R7_PLUS language for round 7 and above", () => {
      expect(getDemandLanguage(7)).toBe(DEMAND_LANGUAGE.R7_PLUS);
      expect(getDemandLanguage(8)).toBe(DEMAND_LANGUAGE.R7_PLUS);
      expect(getDemandLanguage(10)).toBe(DEMAND_LANGUAGE.R7_PLUS);
      expect(getDemandLanguage(12)).toBe(DEMAND_LANGUAGE.R7_PLUS);
    });
  });

  describe("getTemplate()", () => {
    it("returns ACCURACY template for round 1", () => {
      const template = getTemplate("ACCURACY", 1);
      expect(template).not.toBeNull();
      expect(template!.flow).toBe("ACCURACY");
      expect(template!.round).toBe(1);
    });

    it("returns COLLECTION template for round 1", () => {
      const template = getTemplate("COLLECTION", 1);
      expect(template).not.toBeNull();
      expect(template!.flow).toBe("COLLECTION");
    });

    it("returns ACCURACY template for COLLECTION R5-R7", () => {
      const template5 = getTemplate("COLLECTION", 5);
      expect(template5).not.toBeNull();
      // Flow should be set to ACCURACY when switching
      expect(template5!.flow).toBe("ACCURACY");

      const template7 = getTemplate("COLLECTION", 7);
      expect(template7).not.toBeNull();
      expect(template7!.flow).toBe("ACCURACY");
    });

    it("returns CONSENT template for round 1-3", () => {
      for (let r = 1; r <= 3; r++) {
        const template = getTemplate("CONSENT", r);
        expect(template).not.toBeNull();
        expect(template!.flow).toBe("CONSENT");
      }
    });

    it("returns null for non-existent round", () => {
      const template = getTemplate("CONSENT", 99);
      expect(template).toBeNull();
    });

    it("returns ACCURACY templates for COMBO flow", () => {
      const template = getTemplate("COMBO", 1);
      expect(template).not.toBeNull();
      expect(template!.flow).toBe("COMBO");
    });

    it("returned template includes round and flow", () => {
      const template = getTemplate("ACCURACY", 3);
      expect(template).not.toBeNull();
      expect(template!.round).toBe(3);
      expect(template!.flow).toBe("ACCURACY");
      expect(template!.headline).toBeTruthy();
    });
  });

  describe("shouldIncludeScreenshots()", () => {
    it("returns false for round 1", () => {
      expect(shouldIncludeScreenshots(1)).toBe(false);
    });

    it("returns true for round 2", () => {
      expect(shouldIncludeScreenshots(2)).toBe(true);
    });

    it("returns true for round 5", () => {
      expect(shouldIncludeScreenshots(5)).toBe(true);
    });

    it("returns true for round 10", () => {
      expect(shouldIncludeScreenshots(10)).toBe(true);
    });
  });

  describe("getEffectiveFlow()", () => {
    it("returns same flow for ACCURACY at any round", () => {
      expect(getEffectiveFlow("ACCURACY", 1)).toBe("ACCURACY");
      expect(getEffectiveFlow("ACCURACY", 5)).toBe("ACCURACY");
      expect(getEffectiveFlow("ACCURACY", 11)).toBe("ACCURACY");
    });

    it("returns ACCURACY for COLLECTION at rounds 5-7", () => {
      expect(getEffectiveFlow("COLLECTION", 5)).toBe("ACCURACY");
      expect(getEffectiveFlow("COLLECTION", 6)).toBe("ACCURACY");
      expect(getEffectiveFlow("COLLECTION", 7)).toBe("ACCURACY");
    });

    it("returns COLLECTION for COLLECTION outside rounds 5-7", () => {
      expect(getEffectiveFlow("COLLECTION", 1)).toBe("COLLECTION");
      expect(getEffectiveFlow("COLLECTION", 4)).toBe("COLLECTION");
      expect(getEffectiveFlow("COLLECTION", 8)).toBe("COLLECTION");
    });

    it("returns ACCURACY for COMBO at rounds 5-7", () => {
      expect(getEffectiveFlow("COMBO", 5)).toBe("ACCURACY");
      expect(getEffectiveFlow("COMBO", 6)).toBe("ACCURACY");
      expect(getEffectiveFlow("COMBO", 7)).toBe("ACCURACY");
    });

    it("returns COMBO for COMBO outside rounds 5-7", () => {
      expect(getEffectiveFlow("COMBO", 1)).toBe("COMBO");
      expect(getEffectiveFlow("COMBO", 4)).toBe("COMBO");
      expect(getEffectiveFlow("COMBO", 8)).toBe("COMBO");
    });

    it("returns CONSENT unchanged at any round", () => {
      expect(getEffectiveFlow("CONSENT", 1)).toBe("CONSENT");
      expect(getEffectiveFlow("CONSENT", 3)).toBe("CONSENT");
    });
  });

  describe("CRA_ADDRESSES", () => {
    it("has TRANSUNION address data", () => {
      expect(CRA_ADDRESSES.TRANSUNION).toBeDefined();
      expect(CRA_ADDRESSES.TRANSUNION.name).toBe("TransUnion");
      expect(CRA_ADDRESSES.TRANSUNION.lines).toBeInstanceOf(Array);
      expect(CRA_ADDRESSES.TRANSUNION.lines.length).toBeGreaterThan(0);
    });

    it("has EXPERIAN address data", () => {
      expect(CRA_ADDRESSES.EXPERIAN).toBeDefined();
      expect(CRA_ADDRESSES.EXPERIAN.name).toBe("Experian");
      expect(CRA_ADDRESSES.EXPERIAN.lines).toBeInstanceOf(Array);
      expect(CRA_ADDRESSES.EXPERIAN.lines.length).toBeGreaterThan(0);
    });

    it("has EQUIFAX address data", () => {
      expect(CRA_ADDRESSES.EQUIFAX).toBeDefined();
      expect(CRA_ADDRESSES.EQUIFAX.name).toBe("Equifax");
      expect(CRA_ADDRESSES.EQUIFAX.lines).toBeInstanceOf(Array);
      expect(CRA_ADDRESSES.EQUIFAX.lines.length).toBeGreaterThan(0);
    });

    it("each CRA address includes P.O. Box", () => {
      for (const cra of ["TRANSUNION", "EXPERIAN", "EQUIFAX"]) {
        const address = CRA_ADDRESSES[cra];
        const hasPoBox = address.lines.some((line: string) => line.includes("P.O. Box"));
        expect(hasPoBox).toBe(true);
      }
    });
  });

  describe("Template Content Placeholders", () => {
    it("ACCURACY R2+ templates reference lastDisputeDate", () => {
      // R2 should reference the previous dispute date
      const template = ACCURACY_TEMPLATES[2];
      expect(template.openingParagraph).toContain("{lastDisputeDate}");
    });

    it("COLLECTION templates reference debtCollectorNames", () => {
      const template = COLLECTION_TEMPLATES[1];
      expect(template.bodyParagraphs.join(" ")).toContain("{debtCollectorNames}");
    });

    it("CONSENT templates reference bureauName", () => {
      const template = CONSENT_TEMPLATES[1];
      expect(template.openingParagraph + template.bodyParagraphs.join(" ")).toContain(
        "{bureauName}"
      );
    });
  });
});
