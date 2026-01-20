/**
 * Demo script to show Amelia's letter generation
 * Run with: npx ts-node scripts/demo-amelia.ts
 */

import {
  generateAmeliaLetter,
  type LetterGenerationRequest,
} from "../src/lib/amelia";

async function demoAmeliaLetter() {
  // Sample client data
  const request: LetterGenerationRequest = {
    client: {
      id: "demo-client-001",
      firstName: "Marcus",
      lastName: "Thompson",
      address: "4521 Willow Creek Drive",
      city: "Atlanta",
      state: "GA",
      zip: "30318",
      ssn4: "7842",
      dob: "March 15, 1985",
    },
    accounts: [
      {
        creditorName: "Capital One Bank",
        accountNumber: "****4821",
        accountType: "Credit Card",
        balance: 3247,
        issues: [
          "Balance reported differs from actual payoff amount",
          "Late payment marked incorrectly for June 2024",
        ],
      },
      {
        creditorName: "Midland Credit Management",
        accountNumber: "****9012",
        balance: 1856,
        issues: [
          "Debt collector reporting without proper validation",
          "Original creditor information missing",
        ],
      },
      {
        creditorName: "Synchrony Bank",
        accountNumber: "****3377",
        accountType: "Store Card",
        balance: 0,
        issues: [
          "Account shows charge-off but was settled in full",
          "Status not updated after payment agreement completed",
        ],
      },
    ],
    cra: "EQUIFAX",
    flow: "COMBO",
    round: 1,
    organizationId: "demo-org",
  };

  console.log("=" .repeat(80));
  console.log("AMELIA LETTER GENERATION DEMO - ROUND 1");
  console.log("=".repeat(80));
  console.log("\nGenerating unique letter for Marcus Thompson...\n");

  try {
    const result = await generateAmeliaLetter(request);

    console.log("GENERATED LETTER:");
    console.log("-".repeat(80));
    console.log(result.content);
    console.log("-".repeat(80));
    console.log("\nMETADATA:");
    console.log(`  Tone: ${result.tone}`);
    console.log(`  Citations: ${result.citations.join(", ")}`);
    console.log(`  Uniqueness Score: ${result.uniquenessScore}%`);
    console.log(`  Content Hash: ${result.contentHash}`);
    console.log(`  Amelia Version: ${result.ameliaVersion}`);

    // Now generate a Round 2 letter to show escalation
    console.log("\n\n");
    console.log("=".repeat(80));
    console.log("AMELIA LETTER GENERATION DEMO - ROUND 2 (ESCALATION)");
    console.log("=".repeat(80));

    const round2Request: LetterGenerationRequest = {
      ...request,
      round: 2,
      previousHistory: {
        previousRounds: [1],
        previousResponses: ["Items verified as accurate without documentation"],
        daysWithoutResponse: 35,
      },
    };

    const round2Result = await generateAmeliaLetter(round2Request);

    console.log("\nGENERATED LETTER:");
    console.log("-".repeat(80));
    console.log(round2Result.content);
    console.log("-".repeat(80));
    console.log("\nMETADATA:");
    console.log(`  Tone: ${round2Result.tone}`);
    console.log(`  Citations: ${round2Result.citations.join(", ")}`);
    console.log(`  Uniqueness Score: ${round2Result.uniquenessScore}%`);
    console.log(`  Content Hash: ${round2Result.contentHash}`);

    // Round 3 - Aggressive
    console.log("\n\n");
    console.log("=".repeat(80));
    console.log("AMELIA LETTER GENERATION DEMO - ROUND 3 (AGGRESSIVE)");
    console.log("=".repeat(80));

    const round3Request: LetterGenerationRequest = {
      ...request,
      round: 3,
      previousHistory: {
        previousRounds: [1, 2],
        previousResponses: [
          "Items verified as accurate without documentation",
          "Method of verification not provided",
        ],
        daysWithoutResponse: 45,
      },
    };

    const round3Result = await generateAmeliaLetter(round3Request);

    console.log("\nGENERATED LETTER:");
    console.log("-".repeat(80));
    console.log(round3Result.content);
    console.log("-".repeat(80));
    console.log("\nMETADATA:");
    console.log(`  Tone: ${round3Result.tone}`);
    console.log(`  Citations: ${round3Result.citations.join(", ")}`);
    console.log(`  Uniqueness Score: ${round3Result.uniquenessScore}%`);

  } catch (error) {
    console.error("Error generating letter:", error);
  }
}

// Run the demo
demoAmeliaLetter();
