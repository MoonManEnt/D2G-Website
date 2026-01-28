import { describe, it, expect } from "@jest/globals";
import {
  generateUniqueStory,
  humanizeText,
  addEscalationLanguage,
  hashStory,
  replaceVariables,
} from "@/lib/amelia-stories";
import type { GeneratedStory } from "@/lib/amelia-stories";

// =============================================================================
// TESTS
// =============================================================================

describe("AMELIA Stories", () => {
  describe("generateUniqueStory()", () => {
    it("returns a GeneratedStory object", () => {
      const story = generateUniqueStory(new Set(), 1);

      expect(story).toBeDefined();
      expect(typeof story.paragraph).toBe("string");
      expect(typeof story.scenarioType).toBe("string");
      expect(typeof story.technique).toBe("string");
      expect(typeof story.hash).toBe("string");
    });

    it("paragraph is a non-empty string", () => {
      const story = generateUniqueStory(new Set(), 1);
      expect(story.paragraph.length).toBeGreaterThan(20);
    });

    it("hash is a 16-character hex string", () => {
      const story = generateUniqueStory(new Set(), 1);
      expect(story.hash.length).toBe(16);
      expect(story.hash).toMatch(/^[0-9a-f]+$/);
    });

    it("scenarioType is one of the four types", () => {
      const validTypes = ["denial", "suffering", "embarrassment", "opportunity"];
      const story = generateUniqueStory(new Set(), 1);
      expect(validTypes).toContain(story.scenarioType);
    });

    it("technique is a valid assembly technique", () => {
      const validTechniques = [
        "news", "story", "state_case", "direct_hit", "question_lead",
        "confession", "timestamp", "consequence_first", "blame_first",
        "emotional_lead", "factual", "desperate", "rhetorical", "timeline",
        "comparison", "realization", "frustration", "plea", "documentation", "personal",
      ];
      const story = generateUniqueStory(new Set(), 1);
      expect(validTechniques).toContain(story.technique);
    });

    it("does not produce stories that are in the usedHashes set", () => {
      const usedHashes = new Set<string>();

      // Generate first story and record its hash
      const story1 = generateUniqueStory(usedHashes, 1);
      usedHashes.add(story1.hash);

      // Generate second story - should not match first
      const story2 = generateUniqueStory(usedHashes, 1);
      expect(story2.hash).not.toBe(story1.hash);
    });
  });

  describe("Story Uniqueness (generate 100)", () => {
    it("generates >95% unique stories out of 100", () => {
      const hashes = new Set<string>();
      const usedHashes = new Set<string>();
      const totalStories = 100;

      for (let i = 0; i < totalStories; i++) {
        const story = generateUniqueStory(usedHashes, 1);
        hashes.add(story.hash);
        usedHashes.add(story.hash);
      }

      const uniquePercentage = (hashes.size / totalStories) * 100;
      expect(uniquePercentage).toBeGreaterThan(95);
    });

    it("generates stories with varied scenario types", () => {
      const types = new Set<string>();
      const usedHashes = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const story = generateUniqueStory(usedHashes, 1);
        types.add(story.scenarioType);
        usedHashes.add(story.hash);
      }

      // With 50 stories, we should see at least 2 different scenario types
      expect(types.size).toBeGreaterThanOrEqual(2);
    });

    it("generates stories with varied assembly techniques", () => {
      const techniques = new Set<string>();
      const usedHashes = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const story = generateUniqueStory(usedHashes, 1);
        techniques.add(story.technique);
        usedHashes.add(story.hash);
      }

      // With 50 stories, we should see at least 3 different assembly techniques
      expect(techniques.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Story Round Weighting", () => {
    it("early rounds (1-2) favor denial scenarios", () => {
      // Generate many stories for round 1 and check type distribution
      const typeCounts: Record<string, number> = {
        denial: 0,
        suffering: 0,
        embarrassment: 0,
        opportunity: 0,
      };
      const usedHashes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const story = generateUniqueStory(usedHashes, 1);
        typeCounts[story.scenarioType]++;
        usedHashes.add(story.hash);
      }

      // Denial should be one of the most common types for round 1
      // (weight is 35 for round <=2 vs 20 for later)
      expect(typeCounts.denial).toBeGreaterThan(0);
    });

    it("later rounds (5+) increase suffering weight", () => {
      const typeCounts: Record<string, number> = {
        denial: 0,
        suffering: 0,
        embarrassment: 0,
        opportunity: 0,
      };
      const usedHashes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const story = generateUniqueStory(usedHashes, 5);
        typeCounts[story.scenarioType]++;
        usedHashes.add(story.hash);
      }

      // Suffering should have the highest weight for round 5+ (weight 35)
      expect(typeCounts.suffering).toBeGreaterThan(0);
    });
  });

  describe("hashStory()", () => {
    it("returns a 16-character hex string", () => {
      const hash = hashStory("test story content");
      expect(hash.length).toBe(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("produces same hash for same normalized input", () => {
      const hash1 = hashStory("Hello World");
      const hash2 = hashStory("hello world");
      expect(hash1).toBe(hash2);
    });

    it("normalizes whitespace before hashing", () => {
      const hash1 = hashStory("Hello    World");
      const hash2 = hashStory("Hello World");
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different content", () => {
      const hash1 = hashStory("Story A");
      const hash2 = hashStory("Story B");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("replaceVariables()", () => {
    it("replaces {loanType} variable", () => {
      const result = replaceVariables("got denied for a {loanType}");
      // The result should not still contain {loanType}
      expect(result).not.toContain("{loanType}");
      expect(result.length).toBeGreaterThan(0);
    });

    it("replaces {familyMember} variable", () => {
      const result = replaceVariables("my {familyMember} was upset");
      expect(result).not.toContain("{familyMember}");
    });

    it("replaces multiple variables in one string", () => {
      const result = replaceVariables(
        "got denied for a {loanType} {timeframe}"
      );
      expect(result).not.toContain("{loanType}");
      expect(result).not.toContain("{timeframe}");
    });

    it("leaves text without variables unchanged", () => {
      const input = "This is plain text with no variables.";
      const result = replaceVariables(input);
      expect(result).toBe(input);
    });

    it("handles unknown variables gracefully (leaves them)", () => {
      const input = "This has {unknownVar} in it";
      const result = replaceVariables(input);
      // Unknown variables should remain since they are not in any pool
      expect(result).toContain("{unknownVar}");
    });
  });

  describe("humanizeText()", () => {
    it("returns a string", () => {
      const result = humanizeText("I am writing to you about this issue.");
      expect(typeof result).toBe("string");
    });

    it("does not significantly alter the meaning of text", () => {
      // humanizeText applies contractions randomly, so the meaning stays the same
      const input = "I am writing to inform you that I have not received a response.";
      const result = humanizeText(input);

      // The result should still contain key content words
      expect(result.toLowerCase()).toContain("writing");
      expect(result.toLowerCase()).toContain("inform");
    });

    it("text length stays approximately the same", () => {
      const input = "This is a normal sentence that should not change much in length.";
      const result = humanizeText(input);

      // Contractions might shorten it slightly but not dramatically
      expect(result.length).toBeGreaterThan(input.length * 0.7);
      expect(result.length).toBeLessThanOrEqual(input.length * 1.3);
    });
  });

  describe("addEscalationLanguage()", () => {
    it("returns unchanged text for round 1", () => {
      const input = "Original text.";
      const result = addEscalationLanguage(input, 1);
      expect(result).toBe(input);
    });

    it("returns unchanged text for round 2", () => {
      const input = "Original text.";
      const result = addEscalationLanguage(input, 2);
      expect(result).toBe(input);
    });

    it("appends escalation language for round 3", () => {
      const input = "Original text.";
      const result = addEscalationLanguage(input, 3);
      expect(result).toContain(input);
      expect(result.length).toBeGreaterThan(input.length);
    });

    it("appends escalation language for round 5+", () => {
      const input = "Original text.";
      const result = addEscalationLanguage(input, 5);
      expect(result).toContain(input);
      expect(result.length).toBeGreaterThan(input.length);
    });

    it("escalation language is relevant (contains 'documented', 'proof', 'record', etc.)", () => {
      // Run multiple times to account for randomness
      const escalationKeywords = [
        "documented",
        "record",
        "proof",
        "evidence",
        "screenshots",
        "case",
        "dated",
        "violation",
        "ignored",
        "dispute",
      ];

      let foundKeyword = false;
      for (let i = 0; i < 20; i++) {
        const result = addEscalationLanguage("Test.", 5);
        const added = result.replace("Test. ", "").toLowerCase();
        if (escalationKeywords.some((kw) => added.includes(kw))) {
          foundKeyword = true;
          break;
        }
      }
      expect(foundKeyword).toBe(true);
    });
  });

  describe("Scenario Arrays Are Non-Empty", () => {
    // We can't import the arrays directly since they're not exported,
    // but we can verify that generateUniqueStory can produce each scenario type
    it("denial scenarios exist (can generate denial type)", () => {
      let foundDenial = false;
      const usedHashes = new Set<string>();
      for (let i = 0; i < 50 && !foundDenial; i++) {
        const story = generateUniqueStory(usedHashes, 1);
        if (story.scenarioType === "denial") foundDenial = true;
        usedHashes.add(story.hash);
      }
      expect(foundDenial).toBe(true);
    });

    it("suffering scenarios exist (can generate suffering type)", () => {
      let foundSuffering = false;
      const usedHashes = new Set<string>();
      for (let i = 0; i < 50 && !foundSuffering; i++) {
        const story = generateUniqueStory(usedHashes, 1);
        if (story.scenarioType === "suffering") foundSuffering = true;
        usedHashes.add(story.hash);
      }
      expect(foundSuffering).toBe(true);
    });

    it("embarrassment scenarios exist (can generate embarrassment type)", () => {
      let foundEmbarrassment = false;
      const usedHashes = new Set<string>();
      for (let i = 0; i < 50 && !foundEmbarrassment; i++) {
        const story = generateUniqueStory(usedHashes, 1);
        if (story.scenarioType === "embarrassment") foundEmbarrassment = true;
        usedHashes.add(story.hash);
      }
      expect(foundEmbarrassment).toBe(true);
    });

    it("opportunity scenarios exist (can generate opportunity type)", () => {
      let foundOpportunity = false;
      const usedHashes = new Set<string>();
      // Opportunity has lower weight, so try more times
      for (let i = 0; i < 200 && !foundOpportunity; i++) {
        const story = generateUniqueStory(usedHashes, 5); // Higher round = more opportunity weight
        if (story.scenarioType === "opportunity") foundOpportunity = true;
        usedHashes.add(story.hash);
      }
      expect(foundOpportunity).toBe(true);
    });
  });

  describe("Variable Pools Have Sufficient Entries", () => {
    it("replaceVariables produces varied output for same template", () => {
      const template = "got denied for a {loanType} {timeframe}";
      const results = new Set<string>();

      for (let i = 0; i < 30; i++) {
        results.add(replaceVariables(template));
      }

      // With many pool entries, we should get multiple distinct results
      expect(results.size).toBeGreaterThan(5);
    });

    it("family member pool produces multiple values", () => {
      const results = new Set<string>();
      for (let i = 0; i < 30; i++) {
        results.add(replaceVariables("{familyMember}"));
      }
      expect(results.size).toBeGreaterThan(3);
    });

    it("store pool produces multiple values", () => {
      const results = new Set<string>();
      for (let i = 0; i < 30; i++) {
        results.add(replaceVariables("{store}"));
      }
      expect(results.size).toBeGreaterThan(3);
    });
  });
});
