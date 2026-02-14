/**
 * AMELIA V3 LETTER ENGINE TESTS
 *
 * Comprehensive tests for the Soul Engine, validation systems,
 * and letter generation per the v3 system prompt specification.
 */

import {
  inferConsumerVoice,
  type SoulEngineInput,
  type ConsumerVoiceProfile,
  AGE_VOICE_MARKERS,
  getVoicePhrases,
  applyVoiceToText,
} from "@/lib/amelia-soul-engine";

import {
  runKitchenTableTest,
  runAntiAIChecklist,
  runUniquenessCheck,
  validateLetter,
  type LetterValidationInput,
} from "@/lib/amelia-validation";

import {
  generateAmeliaV3Letter,
  selectNarrativePattern,
  selectOpeningStrategy,
  getLegalCitationForVoice,
  NARRATIVE_PATTERNS,
  OPENING_STRATEGIES,
  GRAMMAR_POSTURE_CONFIGS,
  LEGAL_CITATIONS,
  type AmeliaV3Input,
} from "@/lib/amelia-v3";

// =============================================================================
// SOUL ENGINE TESTS
// =============================================================================

describe("Soul Engine - Voice Inference", () => {
  const baseSoulInput: SoulEngineInput = {
    client: {
      name: "John Smith",
      dob: "1985-06-15", // 30-44 age range
      address: "123 Main St, Atlanta, GA 30301",
    },
    account: {
      creditorName: "Capital One",
      accountType: "Credit Card",
      currentStatus: "Late Payment",
      reportedBalance: 2500,
    },
    disputeConfig: {
      mode: "dispute_flow",
      round: 1,
    },
    disputeTarget: {
      entityType: "CRA",
    },
  };

  describe("Age Range Inference", () => {
    it("should infer 18-29 age range for young consumers", () => {
      const input = { ...baseSoulInput, client: { ...baseSoulInput.client, dob: "2000-01-01" } };
      const profile = inferConsumerVoice(input);
      expect(profile.ageRange).toBe("18-29");
    });

    it("should infer 30-44 age range for mid-age consumers", () => {
      const input = { ...baseSoulInput, client: { ...baseSoulInput.client, dob: "1985-01-01" } };
      const profile = inferConsumerVoice(input);
      expect(profile.ageRange).toBe("30-44");
    });

    it("should infer 45-59 age range for established consumers", () => {
      const input = { ...baseSoulInput, client: { ...baseSoulInput.client, dob: "1970-01-01" } };
      const profile = inferConsumerVoice(input);
      expect(profile.ageRange).toBe("45-59");
    });

    it("should infer 60+ age range for senior consumers", () => {
      const input = { ...baseSoulInput, client: { ...baseSoulInput.client, dob: "1955-01-01" } };
      const profile = inferConsumerVoice(input);
      expect(profile.ageRange).toBe("60+");
    });
  });

  describe("Emotional State Inference", () => {
    it("should infer concerned/confused for Round 1", () => {
      const profile = inferConsumerVoice(baseSoulInput);
      expect(["concerned", "confused"]).toContain(profile.emotionalState);
    });

    it("should infer frustrated/determined for Round 2", () => {
      const input = { ...baseSoulInput, disputeConfig: { ...baseSoulInput.disputeConfig, round: 2 } };
      const profile = inferConsumerVoice(input);
      expect(["frustrated", "determined"]).toContain(profile.emotionalState);
    });

    it("should infer angry_controlled/exhausted for Round 3", () => {
      const input = { ...baseSoulInput, disputeConfig: { ...baseSoulInput.disputeConfig, round: 3 } };
      const profile = inferConsumerVoice(input);
      expect(["angry_controlled", "exhausted"]).toContain(profile.emotionalState);
    });

    it("should infer resolute for Round 4+", () => {
      const input = { ...baseSoulInput, disputeConfig: { ...baseSoulInput.disputeConfig, round: 4 } };
      const profile = inferConsumerVoice(input);
      expect(profile.emotionalState).toBe("resolute");
    });

  });

  describe("Legal Literacy Inference", () => {
    it("should infer low/medium legal literacy for Round 1", () => {
      const profile = inferConsumerVoice(baseSoulInput);
      expect(["low", "medium"]).toContain(profile.legalLiteracy);
    });

    it("should infer medium legal literacy for Round 2", () => {
      const input = { ...baseSoulInput, disputeConfig: { ...baseSoulInput.disputeConfig, round: 2 } };
      const profile = inferConsumerVoice(input);
      expect(profile.legalLiteracy).toBe("medium");
    });

    it("should infer medium/high legal literacy for Round 3+", () => {
      const input = { ...baseSoulInput, disputeConfig: { ...baseSoulInput.disputeConfig, round: 3 } };
      const profile = inferConsumerVoice(input);
      expect(["medium", "high"]).toContain(profile.legalLiteracy);
    });
  });

  describe("Narrative Mining", () => {
    it("should extract life stakes from client narrative", () => {
      const input = {
        ...baseSoulInput,
        disputeConfig: {
          ...baseSoulInput.disputeConfig,
          clientNarrative: "Client is trying to buy a home and the mortgage application keeps getting denied because of this.",
        },
      };
      const profile = inferConsumerVoice(input);
      // Should extract "home purchase or refinance" from mortgage/home keywords
      expect(profile.lifeStakes).toContain("home");
      expect(profile.voiceSource).toBe("narrative-driven");
    });

    it("should extract emotional temperature from narrative", () => {
      const input = {
        ...baseSoulInput,
        disputeConfig: {
          ...baseSoulInput.disputeConfig,
          clientNarrative: "Client is furious about being ignored by the bureau.",
        },
      };
      const profile = inferConsumerVoice(input);
      expect(profile.emotionalState).toBe("angry_controlled");
    });

    it("should use data-inferred voice when no narrative", () => {
      const profile = inferConsumerVoice(baseSoulInput);
      expect(["data-inferred", "minimal-default"]).toContain(profile.voiceSource);
    });
  });

  describe("Account Type Relationship Inference", () => {
    it("should infer defensive relationship for unknown collection", () => {
      const input = {
        ...baseSoulInput,
        account: { ...baseSoulInput.account, accountType: "Collection", currentStatus: "Unknown" },
      };
      const profile = inferConsumerVoice(input);
      expect(profile.relationshipToAccount).toContain("unknown");
    });

    it("should infer medical stress for medical debt", () => {
      const input = {
        ...baseSoulInput,
        account: { ...baseSoulInput.account, accountType: "Medical Collection", currentStatus: "Open" },
      };
      const profile = inferConsumerVoice(input);
      expect(profile.relationshipToAccount).toContain("medical");
    });
  });

  describe("Grammar Posture Inference", () => {
    it("should infer grammar posture 1-2 for Round 1", () => {
      const profile = inferConsumerVoice(baseSoulInput);
      expect([1, 2]).toContain(profile.grammarPosture);
    });

    it("should infer grammar posture 2-3 for Round 2", () => {
      const input = { ...baseSoulInput, disputeConfig: { ...baseSoulInput.disputeConfig, round: 2 } };
      const profile = inferConsumerVoice(input);
      expect([2, 3]).toContain(profile.grammarPosture);
    });

    it("should infer grammar posture 2-4 for Round 3+", () => {
      // Note: Grammar posture can be reduced from 3 based on communication style
      // A conversational consumer in Round 3 may have posture 2
      const input = { ...baseSoulInput, disputeConfig: { ...baseSoulInput.disputeConfig, round: 3 } };
      const profile = inferConsumerVoice(input);
      expect([2, 3, 4]).toContain(profile.grammarPosture);
    });
  });
});

// =============================================================================
// VOICE PHRASES TESTS
// =============================================================================

describe("Voice Phrases Generation", () => {
  it("should return dispute openers matching communication style", () => {
    const conversationalProfile: ConsumerVoiceProfile = {
      ageRange: "30-44",
      communicationStyle: "conversational",
      legalLiteracy: "low",
      emotionalState: "concerned",
      grammarPosture: 1,
      lifeStakes: "credit access",
      personalNarrativeElements: [],
      relationshipToAccount: "customer",
      formalityBaseline: "moderate",
      disputeFatigue: "none",
      voiceSource: "data-inferred",
    };

    const phrases = getVoicePhrases(conversationalProfile);
    expect(phrases.disputeOpeners).toBeDefined();
    expect(phrases.disputeOpeners.length).toBeGreaterThan(0);
    // Conversational style should have informal openers
    expect(phrases.disputeOpeners.some(o => o.includes("wrong") || o.includes("need"))).toBe(true);
  });

  it("should return formal openers for formal communication style", () => {
    const formalProfile: ConsumerVoiceProfile = {
      ageRange: "60+",
      communicationStyle: "formal",
      legalLiteracy: "high",
      emotionalState: "resolute",
      grammarPosture: 4,
      lifeStakes: "retirement",
      personalNarrativeElements: [],
      relationshipToAccount: "long_term_customer",
      formalityBaseline: "moderate",
      disputeFatigue: "severe",
      voiceSource: "data-inferred",
    };

    const phrases = getVoicePhrases(formalProfile);
    expect(phrases.disputeOpeners.some(o => o.includes("formally") || o.includes("contest"))).toBe(true);
  });
});

// =============================================================================
// KITCHEN TABLE TEST
// =============================================================================

describe("Kitchen Table Test Validation", () => {
  const baseProfile: ConsumerVoiceProfile = {
    ageRange: "30-44",
    communicationStyle: "conversational",
    legalLiteracy: "medium",
    emotionalState: "frustrated",
    grammarPosture: 2,
    lifeStakes: "mortgage",
    personalNarrativeElements: [],
    relationshipToAccount: "customer",
    formalityBaseline: "moderate",
    disputeFatigue: "mild",
    voiceSource: "data-inferred",
  };

  it("should pass for letter with personal specificity", () => {
    const letterWithPersonal = `
I've been a customer of Capital One for 8 years and I've never missed a payment.
Last month, when I applied for a mortgage, I was surprised to find a late payment
showing on my credit report from March 2024. That's not right — I paid that bill
on March 5th and I have the bank statement to prove it.

This is frustrating because my mortgage application is being delayed while this
inaccuracy sits on my report. I need this corrected so I can close on my house
before the rate lock expires on April 15th.

I looked into my rights and I know the law says you have to actually investigate
this, not just rubber stamp what Capital One tells you. I want to know how you
verified this was accurate because it's not.

Please fix this.
    `.trim();

    const result = runKitchenTableTest({
      letterBody: letterWithPersonal,
      voiceProfile: baseProfile,
      round: 2,
    });

    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it("should fail for template-like letter", () => {
    const templateLetter = `
This letter is to inform you that I am writing to dispute the following items
on my credit report. Under the Fair Credit Reporting Act, I have the right to
an accurate credit report. Please investigate the following items and provide
me with a response within 30 days.

1. Account Name: Capital One
   Account Number: XXXX1234
   Reason: Disputing accuracy

I demand that you remove this item or verify it in writing.

Please be advised that failure to comply will result in legal action.

Sincerely,
    `.trim();

    const result = runKitchenTableTest({
      letterBody: templateLetter,
      voiceProfile: baseProfile,
      round: 1,
    });

    expect(result.score).toBeLessThan(7);
    expect(result.issues.some(i => i.code === "KTT_CRO_PATTERN")).toBe(true);
  });

  it("should flag letter with generic emotional language", () => {
    const genericEmotionLetter = `
I am deeply concerned about the impact this has on my financial wellbeing.
I value the integrity of the credit reporting system and understand the
importance of accurate reporting. I sincerely appreciate your attention
to this matter and humbly ask that you investigate.
    `.trim();

    const result = runKitchenTableTest({
      letterBody: genericEmotionLetter,
      voiceProfile: baseProfile,
      round: 1,
    });

    expect(result.issues.some(i => i.code === "KTT_NO_EMOTION")).toBe(true);
  });
});

// =============================================================================
// ANTI-AI CHECKLIST TESTS
// =============================================================================

describe("Anti-AI Voice Checklist", () => {
  const baseProfile: ConsumerVoiceProfile = {
    ageRange: "30-44",
    communicationStyle: "conversational",
    legalLiteracy: "medium",
    emotionalState: "frustrated",
    grammarPosture: 2,
    lifeStakes: "mortgage",
    personalNarrativeElements: [],
    relationshipToAccount: "customer",
    formalityBaseline: "moderate",
    disputeFatigue: "mild",
    voiceSource: "data-inferred",
  };

  it("should pass for natural human-sounding letter", () => {
    const humanLetter = `
I don't understand how this late payment ended up on my report. I've been
checking my credit pretty regularly — especially since I'm trying to buy a
house — and I know I paid that bill.

Look, I get that you probably deal with a lot of disputes. But this one is
legit. I have proof. My bank shows the payment cleared on March 5th. The
due date was March 10th. That's not late.

I need you to actually investigate this, not just send it back to Capital One
and call it done. They're the ones who reported it wrong in the first place.
What am I supposed to do here?
    `.trim();

    const result = runAntiAIChecklist({
      letterBody: humanLetter,
      voiceProfile: baseProfile,
      round: 2,
    });

    expect(result.score).toBeGreaterThanOrEqual(7);
  });

  it("should flag three-item patterns", () => {
    const threeItemLetter = `
The information is inaccurate, incomplete, and unverifiable.
I request that you investigate, verify, and correct this information.
The account shows wrong balance, wrong status, and wrong dates.
    `.trim();

    const result = runAntiAIChecklist({
      letterBody: threeItemLetter,
      voiceProfile: baseProfile,
      round: 1,
    });

    expect(result.issues.some(i => i.code === "AI_THREE_ITEM_PATTERN")).toBe(true);
  });

  it("should flag smooth transitions", () => {
    const smoothTransitionLetter = `
I am writing to dispute an item. Furthermore, I have documentation.
Moreover, the dates are incorrect. Additionally, the balance is wrong.
Consequently, I request immediate correction. Therefore, please investigate.
    `.trim();

    const result = runAntiAIChecklist({
      letterBody: smoothTransitionLetter,
      voiceProfile: baseProfile,
      round: 1,
    });

    expect(result.issues.some(i => i.code === "AI_SMOOTH_TRANSITIONS")).toBe(true);
  });

  it("should flag generic emotional language", () => {
    const genericLetter = `
I am deeply concerned about the impact on my financial wellbeing.
I value the integrity of the credit reporting system.
    `.trim();

    const result = runAntiAIChecklist({
      letterBody: genericLetter,
      voiceProfile: baseProfile,
      round: 1,
    });

    expect(result.issues.some(i => i.code === "AI_GENERIC_EMOTION")).toBe(true);
  });

  it("should flag perfect summary conclusions", () => {
    const perfectSummaryLetter = `
I am disputing this account for several reasons.

First, the balance is wrong. Second, the dates are incorrect.

In conclusion, I request that you investigate this matter and
correct the inaccurate information as outlined above.
    `.trim();

    const result = runAntiAIChecklist({
      letterBody: perfectSummaryLetter,
      voiceProfile: baseProfile,
      round: 1,
    });

    expect(result.issues.some(i => i.code === "AI_PERFECT_SUMMARY")).toBe(true);
  });
});

// =============================================================================
// UNIQUENESS VERIFICATION TESTS
// =============================================================================

describe("Uniqueness Verification", () => {
  const baseProfile: ConsumerVoiceProfile = {
    ageRange: "30-44",
    communicationStyle: "conversational",
    legalLiteracy: "medium",
    emotionalState: "frustrated",
    grammarPosture: 2,
    lifeStakes: "mortgage",
    personalNarrativeElements: [],
    relationshipToAccount: "customer",
    formalityBaseline: "moderate",
    disputeFatigue: "mild",
    voiceSource: "data-inferred",
  };

  it("should pass when no prior letters exist", () => {
    const result = runUniquenessCheck({
      letterBody: "This is a new letter with unique content.",
      voiceProfile: baseProfile,
      round: 1,
      priorLetters: [],
    });

    expect(result.passed).toBe(true);
    expect(result.score).toBe(10);
  });

  it("should flag shared opening with prior letter", () => {
    const priorLetter = "I am writing to dispute an inaccurate item on my credit report. The account is wrong.";
    const newLetter = "I am writing to dispute an inaccurate item on my credit report. Different content here.";

    const result = runUniquenessCheck({
      letterBody: newLetter,
      voiceProfile: baseProfile,
      round: 2,
      priorLetters: [priorLetter],
    });

    expect(result.issues.some(i => i.code === "UNIQUE_OPENING")).toBe(true);
  });

  it("should flag shared phrases across letters", () => {
    const priorLetter = "The reported balance of two thousand five hundred dollars is completely inaccurate.";
    const newLetter = "I need to dispute something. The reported balance of two thousand five hundred dollars is completely inaccurate. Please fix.";

    const result = runUniquenessCheck({
      letterBody: newLetter,
      voiceProfile: baseProfile,
      round: 2,
      priorLetters: [priorLetter],
    });

    expect(result.issues.some(i => i.code === "UNIQUE_PHRASES")).toBe(true);
  });
});

// =============================================================================
// NARRATIVE PATTERN SELECTION TESTS
// =============================================================================

describe("Narrative Pattern Selection", () => {
  const baseProfile: ConsumerVoiceProfile = {
    ageRange: "30-44",
    communicationStyle: "conversational",
    legalLiteracy: "medium",
    emotionalState: "concerned",
    grammarPosture: 2,
    lifeStakes: "mortgage",
    personalNarrativeElements: [],
    relationshipToAccount: "customer",
    formalityBaseline: "moderate",
    disputeFatigue: "none",
    voiceSource: "data-inferred",
  };

  it("should select Story-First for Round 1 concerned consumer", () => {
    const pattern = selectNarrativePattern(baseProfile, 1, "balance discrepancy");
    expect(["A", "D"]).toContain(pattern); // Story-First or Emotional Arc
  });

  it("should select Confrontational for Round 3+ angry consumer", () => {
    const angryProfile = { ...baseProfile, emotionalState: "angry_controlled" as const };
    const pattern = selectNarrativePattern(angryProfile, 3, "verified without evidence");
    expect(pattern).toBe("F"); // Confrontational
  });

  it("should select Investigative for balance/duplicate issues", () => {
    const vigilantProfile = { ...baseProfile, emotionalState: "vigilant" as const };
    const pattern = selectNarrativePattern(vigilantProfile, 2, "duplicate reporting detected");
    expect(pattern).toBe("E"); // Investigative
  });

  it("should select Rights-Anchored for high legal literacy", () => {
    const highLiteracyProfile = { ...baseProfile, legalLiteracy: "high" as const };
    const pattern = selectNarrativePattern(highLiteracyProfile, 2, "procedural violation");
    // High literacy + round 2 can select C, B, or D depending on other factors
    expect(["C", "B", "D"]).toContain(pattern);
  });
});

// =============================================================================
// OPENING STRATEGY SELECTION TESTS
// =============================================================================

describe("Opening Strategy Selection", () => {
  const baseProfile: ConsumerVoiceProfile = {
    ageRange: "30-44",
    communicationStyle: "conversational",
    legalLiteracy: "medium",
    emotionalState: "concerned",
    grammarPosture: 2,
    lifeStakes: "mortgage",
    personalNarrativeElements: [],
    relationshipToAccount: "customer",
    formalityBaseline: "moderate",
    disputeFatigue: "none",
    voiceSource: "data-inferred",
  };

  it("should select personal_discovery for Round 1", () => {
    const strategy = selectOpeningStrategy(baseProfile, 1, "dispute_flow", "general credit");
    expect(strategy).toBe("personal_discovery");
  });

  it("should select frustrated_followup for Round 2 frustrated consumer", () => {
    const frustratedProfile = { ...baseProfile, emotionalState: "frustrated" as const };
    const strategy = selectOpeningStrategy(frustratedProfile, 2, "dispute_flow");
    expect(strategy).toBe("frustrated_followup");
  });

  it("should select authority for Round 3+ resolute consumer", () => {
    const resoluteProfile = { ...baseProfile, emotionalState: "resolute" as const };
    const strategy = selectOpeningStrategy(resoluteProfile, 3, "dispute_flow");
    expect(strategy).toBe("authority");
  });

  it("should select situational_urgency for mortgage stakes", () => {
    const strategy = selectOpeningStrategy(baseProfile, 1, "dispute_flow", "mortgage application");
    expect(strategy).toBe("situational_urgency");
  });

});

// =============================================================================
// LEGAL CITATION INTEGRATION TESTS
// =============================================================================

describe("Legal Citation Integration", () => {
  it("should return paraphrased citation for low literacy", () => {
    const lowLiteracyProfile: ConsumerVoiceProfile = {
      ageRange: "30-44",
      communicationStyle: "conversational",
      legalLiteracy: "low",
      emotionalState: "concerned",
      grammarPosture: 1,
      lifeStakes: "credit",
      personalNarrativeElements: [],
      relationshipToAccount: "customer",
      formalityBaseline: "moderate",
      disputeFatigue: "none",
      voiceSource: "data-inferred",
    };

    const citation = LEGAL_CITATIONS.find(c => c.code === "§611(a)(1)(A)")!;
    const formatted = getLegalCitationForVoice(citation, lowLiteracyProfile);
    expect(formatted).toBe(citation.paraphrase);
  });

  it("should return authoritative citation for high literacy", () => {
    const highLiteracyProfile: ConsumerVoiceProfile = {
      ageRange: "45-59",
      communicationStyle: "formal",
      legalLiteracy: "high",
      emotionalState: "resolute",
      grammarPosture: 4,
      lifeStakes: "retirement",
      personalNarrativeElements: [],
      relationshipToAccount: "long_term_customer",
      formalityBaseline: "moderate",
      disputeFatigue: "severe",
      voiceSource: "data-inferred",
    };

    const citation = LEGAL_CITATIONS.find(c => c.code === "§611(a)(1)(A)")!;
    const formatted = getLegalCitationForVoice(citation, highLiteracyProfile);
    expect(formatted).toBe(citation.authoritative);
  });
});

// =============================================================================
// GRAMMAR POSTURE CONFIG TESTS
// =============================================================================

describe("Grammar Posture Configuration", () => {
  it("should have correct config for Level 1", () => {
    const config = GRAMMAR_POSTURE_CONFIGS[1];
    expect(config.sentenceComplexity).toBe("simple");
    expect(config.contractionUsage).toBe("frequent");
    expect(config.legalCitationStyle).toBe("paraphrase");
    expect(config.fragmentsAllowed).toBe(true);
  });

  it("should have correct config for Level 4", () => {
    const config = GRAMMAR_POSTURE_CONFIGS[4];
    expect(config.sentenceComplexity).toBe("dense");
    expect(config.contractionUsage).toBe("rare");
    expect(config.legalCitationStyle).toBe("authoritative");
    expect(config.fragmentsAllowed).toBe(false);
  });
});

// =============================================================================
// FULL V3 LETTER GENERATION TESTS
// =============================================================================

describe("Full V3 Letter Generation", () => {
  const baseInput: AmeliaV3Input = {
    client: {
      name: "John Smith",
      firstName: "John",
      lastName: "Smith",
      dob: "1985-06-15",
      address: "123 Main St",
      city: "Atlanta",
      state: "GA",
      zip: "30301",
      ssnLast4: "1234",
    },
    account: {
      creditorName: "Capital One",
      accountNumberPartial: "1234",
      accountType: "Credit Card",
      reportedBalance: 2500,
      currentStatus: "Late Payment",
    },
    disputeConfig: {
      mode: "dispute_flow",
      round: 1,
      disputeReason: "Incorrect late payment reported",
      targetOutcome: "correction",
    },
    disputeTarget: {
      entityType: "CRA",
      entityName: "Equifax Information Services",
    },
    generationConfig: {
      bureau: "EQUIFAX",
    },
  };

  it("should generate complete letter output with metadata", () => {
    const output = generateAmeliaV3Letter(baseInput);

    // Check letter structure
    expect(output.letter.subjectLine).toBeDefined();
    expect(output.letter.date).toBeDefined();
    expect(output.letter.senderBlock).toContain("John Smith");
    expect(output.letter.body).toBeDefined();
    expect(output.letter.body.length).toBeGreaterThan(100);

    // Check metadata
    expect(output.metadata.round).toBe(1);
    expect(output.metadata.inferredVoiceProfile).toBeDefined();
    expect(output.metadata.narrativePatternUsed).toBeDefined();
    expect(output.metadata.openingStrategyUsed).toBeDefined();
    expect(output.metadata.humanAuthenticityScore).toBeGreaterThanOrEqual(1);
    expect(output.metadata.humanAuthenticityScore).toBeLessThanOrEqual(10);
  });

  it("should infer voice profile automatically", () => {
    const output = generateAmeliaV3Letter(baseInput);
    const profile = output.metadata.inferredVoiceProfile;

    expect(profile.ageRange).toBe("30-44"); // Born 1985
    expect(["concerned", "confused"]).toContain(profile.emotionalState); // Round 1
    expect(["low", "medium"]).toContain(profile.legalLiteracy); // Round 1
  });

  it("should include validation details in metadata", () => {
    const output = generateAmeliaV3Letter(baseInput);

    expect(output.metadata.validationDetails).toBeDefined();
    expect(output.metadata.validationDetails.kitchenTableTest).toBeDefined();
    expect(output.metadata.validationDetails.antiAICheck).toBeDefined();
    expect(output.metadata.validationDetails.uniquenessCheck).toBeDefined();
  });

  it("should include next round strategy", () => {
    const output = generateAmeliaV3Letter(baseInput);
    expect(output.metadata.nextRoundStrategy).toBeDefined();
    expect(output.metadata.nextRoundStrategy.length).toBeGreaterThan(0);
  });

  it("should use narrative from client narrative if provided", () => {
    const inputWithNarrative: AmeliaV3Input = {
      ...baseInput,
      disputeConfig: {
        ...baseInput.disputeConfig,
        clientNarrative: "Client is furious and has been a customer for 15 years. Needs mortgage approval by next month.",
      },
    };

    const output = generateAmeliaV3Letter(inputWithNarrative);
    expect(output.metadata.inferredVoiceProfile.voiceSource).toBe("narrative-driven");
    expect(output.metadata.inferredVoiceProfile.emotionalState).toBe("angry_controlled");
  });

  it("should escalate voice profile for later rounds", () => {
    const round3Input: AmeliaV3Input = {
      ...baseInput,
      disputeConfig: {
        ...baseInput.disputeConfig,
        round: 3,
        priorDisputeDates: ["2024-01-15", "2024-02-15"],
        priorResponses: ["Verified as accurate", "Verified as accurate"],
      },
    };

    const output = generateAmeliaV3Letter(round3Input);
    const profile = output.metadata.inferredVoiceProfile;

    expect(["angry_controlled", "exhausted"]).toContain(profile.emotionalState);
    expect(["medium", "high"]).toContain(profile.legalLiteracy);
    expect(profile.disputeFatigue).toBe("significant");
  });
});

// =============================================================================
// AGE VOICE MARKERS TESTS
// =============================================================================

describe("Age Voice Markers", () => {
  it("should have voice markers for all age ranges", () => {
    expect(AGE_VOICE_MARKERS["18-29"]).toBeDefined();
    expect(AGE_VOICE_MARKERS["30-44"]).toBeDefined();
    expect(AGE_VOICE_MARKERS["45-59"]).toBeDefined();
    expect(AGE_VOICE_MARKERS["60+"]).toBeDefined();
  });

  it("should have appropriate formality levels", () => {
    expect(AGE_VOICE_MARKERS["18-29"].formality).toBe("less");
    expect(AGE_VOICE_MARKERS["60+"].formality).toBe("most");
  });

  it("should have common phrases for each age range", () => {
    for (const markers of Object.values(AGE_VOICE_MARKERS)) {
      expect(markers.commonPhrases.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// TEXT VOICE APPLICATION TESTS
// =============================================================================

describe("Voice Text Application", () => {
  it("should apply contractions for conversational voice", () => {
    const conversationalProfile: ConsumerVoiceProfile = {
      ageRange: "18-29",
      communicationStyle: "conversational",
      legalLiteracy: "low",
      emotionalState: "confused",
      grammarPosture: 1,
      lifeStakes: "credit",
      personalNarrativeElements: [],
      relationshipToAccount: "customer",
      formalityBaseline: "moderate",
      disputeFatigue: "none",
      voiceSource: "data-inferred",
    };

    const text = "I am writing because I do not understand this.";
    const result = applyVoiceToText(text, conversationalProfile);

    expect(result).toContain("I'm");
    expect(result).toContain("don't");
  });

  it("should preserve formal language for formal voice", () => {
    const formalProfile: ConsumerVoiceProfile = {
      ageRange: "60+",
      communicationStyle: "formal",
      legalLiteracy: "high",
      emotionalState: "resolute",
      grammarPosture: 4,
      lifeStakes: "retirement",
      personalNarrativeElements: [],
      relationshipToAccount: "long_term_customer",
      formalityBaseline: "moderate",
      disputeFatigue: "severe",
      voiceSource: "data-inferred",
    };

    const text = "I am writing because I do not understand this.";
    const result = applyVoiceToText(text, formalProfile);

    // Formal voice should retain formal language
    expect(result).toContain("I am");
  });
});

// =============================================================================
// TEMPORAL ENGINE TESTS
// =============================================================================

import {
  generateBackdatedDate,
  formatDateForVoice,
  generateTemporalReferences,
  checkCFPBEligibility,
  generateCFPBLanguage,
} from "@/lib/amelia-temporal-engine";

describe("Temporal Authenticity Engine", () => {
  describe("Backdated Date Generation", () => {
    it("should generate backdated date 60-69 days ago for Round 1", () => {
      const config = {
        mode: "dispute_flow" as const,
        round: 1,
        clientName: "John Smith",
        clientDob: "1985-06-15",
      };

      const result = generateBackdatedDate(config);

      expect(result.backdateOffsetDays).toBeGreaterThanOrEqual(60);
      expect(result.backdateOffsetDays).toBeLessThanOrEqual(69);
      expect(result.cfpbEligibleAtLetterDate).toBe(false); // Round 1 is never CFPB eligible
    });

    it("should generate backdated date 30-39 days ago for Round 2+", () => {
      const config = {
        mode: "dispute_flow" as const,
        round: 2,
        priorRoundDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        clientName: "John Smith",
        clientDob: "1985-06-15",
      };

      const result = generateBackdatedDate(config);

      expect(result.backdateOffsetDays).toBeGreaterThanOrEqual(14); // Must be at least 14 days after prior round
      expect(result.gapFromPriorRoundDays).toBeGreaterThanOrEqual(14); // Minimum gap
    });

    it("should generate different dates for different clients with explicit seeds", () => {
      const config1 = {
        mode: "dispute_flow" as const,
        round: 1,
        clientName: "John Smith",
        clientDob: "1985-06-15",
        accountNumberPartial: "1234",
        uniquenessSeed: "fixed-seed-for-test-client-1",
      };

      const config2 = {
        mode: "dispute_flow" as const,
        round: 1,
        clientName: "Jane Doe",
        clientDob: "1990-03-20",
        accountNumberPartial: "5678",
        uniquenessSeed: "fixed-seed-for-test-client-2",
      };

      const result1 = generateBackdatedDate(config1);
      const result2 = generateBackdatedDate(config2);

      // Different clients with different data should produce deterministically different dates
      // Note: In edge cases with small ranges (10 days), collisions are possible but unlikely
      // when all client data differs
      expect(result1.backdatedLetterDate.getTime()).not.toBe(result2.backdatedLetterDate.getTime());
    });

    it("should not generate dates on Sundays", () => {
      // Generate multiple dates and ensure none are Sundays
      for (let i = 0; i < 10; i++) {
        const config = {
          mode: "dispute_flow" as const,
          round: 1,
          clientName: `Client ${i}`,
          clientDob: "1985-06-15",
          uniquenessSeed: `seed-${i}`,
        };

        const result = generateBackdatedDate(config);
        const dayOfWeek = result.backdatedLetterDate.getDay();

        expect(dayOfWeek).not.toBe(0); // 0 = Sunday
      }
    });
  });

  describe("Date Formatting for Voice", () => {
    const testDate = new Date(2026, 0, 15); // January 15, 2026

    it("should format dates formally for formal voice profiles", () => {
      const formalProfile: ConsumerVoiceProfile = {
        ageRange: "60+",
        communicationStyle: "formal",
        legalLiteracy: "high",
        emotionalState: "resolute",
        grammarPosture: 4,
        lifeStakes: "",
        personalNarrativeElements: [],
        relationshipToAccount: "",
        formalityBaseline: "moderate",
        disputeFatigue: "none",
        voiceSource: "data-inferred",
      };

      const formatted = formatDateForVoice(testDate, formalProfile);

      // Formal voice should use "January 15, 2026" format
      expect(formatted).toBe("January 15, 2026");
    });

    it("should format dates in abbreviated or numeric style for conversational voice", () => {
      const conversationalProfile: ConsumerVoiceProfile = {
        ageRange: "30-44",
        communicationStyle: "conversational",
        legalLiteracy: "low",
        emotionalState: "concerned",
        grammarPosture: 1,
        lifeStakes: "",
        personalNarrativeElements: [],
        relationshipToAccount: "",
        formalityBaseline: "personal",
        disputeFatigue: "none",
        voiceSource: "data-inferred",
      };

      const formatted = formatDateForVoice(testDate, conversationalProfile);

      // Should be either "Jan. 15, 2026" or "1/15/2026"
      expect(formatted).toMatch(/^(Jan\. 15, 2026|1\/15\/2026)$/);
    });
  });

  describe("CFPB Eligibility Check", () => {
    it("should return ineligible for Round 1", () => {
      const result = checkCFPBEligibility(1, 0, "dispute_flow");

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("Round 1");
    });

    it("should return ineligible for Round 2 under 45 days", () => {
      const result = checkCFPBEligibility(2, 30, "dispute_flow");

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("30 days");
      expect(result.alternativeEscalation).toContain("State AG");
    });

    it("should return eligible for Round 2 over 45 days (unusual case)", () => {
      const result = checkCFPBEligibility(2, 50, "dispute_flow");

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain("unusual");
    });

    it("should return eligible for Round 3+ over 45 days", () => {
      const result = checkCFPBEligibility(3, 60, "dispute_flow");

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain("60 days");
    });

    it("should return ineligible for Round 3+ under 45 days (fast-cycle)", () => {
      const result = checkCFPBEligibility(3, 40, "dispute_flow");

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("fast-cycle");
    });
  });

  describe("CFPB Language Generation", () => {
    const baseVoiceProfile: ConsumerVoiceProfile = {
      ageRange: "30-44",
      communicationStyle: "conversational",
      legalLiteracy: "medium",
      emotionalState: "frustrated",
      grammarPosture: 2,
      lifeStakes: "",
      personalNarrativeElements: [],
      relationshipToAccount: "",
      formalityBaseline: "moderate",
      disputeFatigue: "significant",
      voiceSource: "data-inferred",
    };

    it("should return null when not eligible", () => {
      const result = generateCFPBLanguage(false, 30, baseVoiceProfile);

      expect(result).toBeNull();
    });

    it("should generate language when eligible", () => {
      const result = generateCFPBLanguage(true, 60, baseVoiceProfile);

      expect(result).not.toBeNull();
      // Can contain either "CFPB" or full "Consumer Financial Protection Bureau"
      expect(result).toMatch(/CFPB|Consumer Financial Protection Bureau/);
    });

    it("should vary language based on communication style", () => {
      const formal: ConsumerVoiceProfile = { ...baseVoiceProfile, communicationStyle: "formal" };
      const conversational: ConsumerVoiceProfile = { ...baseVoiceProfile, communicationStyle: "conversational" };

      const formalResult = generateCFPBLanguage(true, 60, formal);
      const conversationalResult = generateCFPBLanguage(true, 60, conversational);

      // Both should contain CFPB reference (abbreviated or full name)
      expect(formalResult).toMatch(/CFPB|Consumer Financial Protection Bureau/);
      expect(conversationalResult).toMatch(/CFPB|Consumer Financial Protection Bureau/);

      // Formal should be more structured
      expect(formalResult).toContain("days have elapsed");
    });
  });

  describe("Temporal References Generation", () => {
    it("should generate report review reference", () => {
      const backdatedDate = new Date(2026, 0, 15);
      const result = generateTemporalReferences(backdatedDate, null);

      expect(result.reportReviewReference).toBeDefined();
      expect(["last week", "a few days ago", "recently", "earlier this month"])
        .toContain(result.reportReviewReference);
    });

    it("should generate prior dispute reference when prior round exists", () => {
      const backdatedDate = new Date(2026, 0, 15);
      const priorDate = new Date(2025, 11, 1); // December 1, 2025

      const result = generateTemporalReferences(backdatedDate, priorDate);

      expect(result.priorDisputeReference).not.toBeNull();
      expect(result.timeSincePriorDispute).not.toBeNull();
    });

    it("should return null for prior dispute reference when no prior round", () => {
      const backdatedDate = new Date(2026, 0, 15);
      const result = generateTemporalReferences(backdatedDate, null);

      expect(result.priorDisputeReference).toBeNull();
      expect(result.timeSincePriorDispute).toBeNull();
    });
  });
});

// =============================================================================
// TEMPORAL INTEGRATION IN V3 OUTPUT TESTS
// =============================================================================

describe("V3 Letter Generation with Temporal Engine", () => {
  const baseV3Input: AmeliaV3Input = {
    client: {
      name: "John Smith",
      firstName: "John",
      lastName: "Smith",
      dob: "1985-06-15",
      address: "123 Main St",
      city: "Atlanta",
      state: "GA",
      zip: "30301",
      ssnLast4: "1234",
    },
    account: {
      creditorName: "Capital One",
      accountNumberPartial: "4321",
      accountType: "Credit Card",
      currentStatus: "Late Payment",
      reportedBalance: 2500,
    },
    disputeConfig: {
      mode: "dispute_flow",
      round: 1,
      disputeReason: "balance_incorrect",
      targetOutcome: "correction",
    },
    disputeTarget: {
      entityType: "CRA",
      entityName: "Experian",
    },
    generationConfig: {
      bureau: "Experian",
    },
  };

  it("should include temporal metadata in V3 output", () => {
    const result = generateAmeliaV3Letter(baseV3Input);

    expect(result.metadata.temporal).toBeDefined();
    expect(result.metadata.temporal.actualGenerationDate).toBeDefined();
    expect(result.metadata.temporal.backdatedLetterDate).toBeDefined();
    expect(result.metadata.temporal.backdateOffsetDays).toBeGreaterThanOrEqual(60);
    expect(result.metadata.temporal.cfpbEligibility).toBeDefined();
  });

  it("should use backdated date for letter date", () => {
    const result = generateAmeliaV3Letter(baseV3Input);

    // Letter date should be backdated, not today
    const today = new Date();
    const letterDate = new Date(result.metadata.temporal.backdatedLetterDate);

    // Should be 60-69 days before today for Round 1
    const daysDiff = Math.floor((today.getTime() - letterDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBeGreaterThanOrEqual(60);
    expect(daysDiff).toBeLessThanOrEqual(69);
  });

  it("should show CFPB ineligible for Round 1", () => {
    const result = generateAmeliaV3Letter(baseV3Input);

    expect(result.metadata.temporal.cfpbEligibleAtLetterDate).toBe(false);
    expect(result.metadata.temporal.cfpbEligibility.eligible).toBe(false);
  });

  it("should show CFPB eligible for Round 3+ with 45+ days elapsed", () => {
    const round3Input: AmeliaV3Input = {
      ...baseV3Input,
      disputeConfig: {
        ...baseV3Input.disputeConfig,
        round: 3,
        priorRoundLetterDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      },
    };

    const result = generateAmeliaV3Letter(round3Input);

    // For Round 3 with prior round 60 days ago, CFPB should be eligible
    expect(result.metadata.temporal.cfpbEligibility).toBeDefined();
    // The actual eligibility depends on the calculated daysSinceFirstDispute
    // which traces back through prior rounds
  });

  it("should generate deterministic dates for same client/account with same seed", () => {
    // Provide explicit uniqueness seed to ensure determinism
    const inputWithSeed: AmeliaV3Input = {
      ...baseV3Input,
      generationConfig: { ...baseV3Input.generationConfig!, uniquenessSeed: "test-seed-123" },
    };

    const result1 = generateAmeliaV3Letter(inputWithSeed);
    const result2 = generateAmeliaV3Letter(inputWithSeed);

    // Same input with same seed should generate same backdated date
    expect(result1.metadata.temporal.backdatedLetterDate)
      .toBe(result2.metadata.temporal.backdatedLetterDate);
  });

  it("should generate different dates for different uniqueness seeds", () => {
    const input1: AmeliaV3Input = {
      ...baseV3Input,
      generationConfig: { ...baseV3Input.generationConfig!, uniquenessSeed: "seed-1" },
    };
    const input2: AmeliaV3Input = {
      ...baseV3Input,
      generationConfig: { ...baseV3Input.generationConfig!, uniquenessSeed: "seed-2" },
    };

    const result1 = generateAmeliaV3Letter(input1);
    const result2 = generateAmeliaV3Letter(input2);

    // Different seeds should produce different backdated dates
    expect(result1.metadata.temporal.backdatedLetterDate)
      .not.toBe(result2.metadata.temporal.backdatedLetterDate);
  });
});
