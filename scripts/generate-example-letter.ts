import { generateLetter } from '../src/lib/amelia-generator';

const exampleClient = {
  fullName: "John Michael Smith",
  firstName: "John",
  lastName: "Smith",
  addressLine1: "1234 Oak Street",
  addressLine2: "Apt 5B",
  city: "Houston",
  state: "TX",
  zipCode: "77001",
  ssnLast4: "4567",
  dateOfBirth: new Date("1985-03-15"),
  previousNames: [],
  previousAddresses: [
    "789 Elm Avenue, Dallas, TX 75201"
  ],
  hardInquiries: [
    { creditorName: "WELLS FARGO", inquiryDate: "August 15, 2025", cra: "TRANSUNION" as const }
  ],
};

const exampleAccounts = [
  {
    creditorName: "CAPITAL ONE",
    accountNumber: "****1234",
    accountType: "Credit Card",
    balance: 5432,
    issues: [
      { code: "BALANCE_MISMATCH", description: "Balance reported as $5,432 but should be $0 - paid in full June 2025" },
      { code: "STATUS_INCORRECT", description: "Shows 60 days past due but account was never late" }
    ]
  },
  {
    creditorName: "MIDLAND CREDIT MANAGEMENT",
    accountNumber: "****5678",
    accountType: "Collection",
    balance: 2100,
    issues: [
      { code: "UNVALIDATED_DEBT", description: "Never received debt validation notice" },
      { code: "BALANCE_INCORRECT", description: "Original debt was $800, now showing $2,100" }
    ]
  }
];

async function main() {
  try {
    const letter = await generateLetter({
      client: exampleClient,
      accounts: exampleAccounts,
      cra: "TRANSUNION",
      flow: "ACCURACY",
      round: 1,
      usedContentHashes: new Set(),
    });

    console.log("=".repeat(80));
    console.log("GENERATED LETTER - ACCURACY FLOW, ROUND 1");
    console.log("=".repeat(80));
    console.log("\n");
    console.log(letter.content);
    console.log("\n");
    console.log("=".repeat(80));
    console.log("METADATA:");
    console.log("=".repeat(80));
    console.log("Letter Date:", letter.letterDate.toLocaleDateString());
    console.log("Is Backdated:", letter.isBackdated, "(" + letter.backdatedDays + " days)");
    console.log("Tone:", letter.tone);
    console.log("Flow:", letter.flow, "(Effective:", letter.effectiveFlow + ")");
    console.log("Round:", letter.round);
    console.log("Statute:", letter.statute);
    console.log("Content Hash:", letter.contentHash);
  } catch (error) {
    console.error("Error generating letter:", error);
  }
}

main();
