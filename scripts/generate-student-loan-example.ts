import { generateLetter } from '../src/lib/amelia-generator';

const exampleClient = {
  fullName: "Marcus Anthony Williams",
  firstName: "Marcus",
  lastName: "Williams",
  addressLine1: "2847 Riverside Drive",
  addressLine2: "",
  city: "Atlanta",
  state: "GA",
  zipCode: "30318",
  ssnLast4: "8821",
  dateOfBirth: new Date("1992-07-22"),
  previousNames: ["Marc Williams", "Marcus A. Williams Jr."],
  previousAddresses: [
    "1520 Peachtree St NE, Apt 412, Atlanta, GA 30309",
    "892 College Park Rd, Morrow, GA 30260"
  ],
  hardInquiries: [
    { creditorName: "DISCOVER FINANCIAL", inquiryDate: "September 3, 2025", cra: "EXPERIAN" as const },
    { creditorName: "SYNCHRONY BANK", inquiryDate: "August 18, 2025", cra: "EXPERIAN" as const },
    { creditorName: "CAPITAL ONE AUTO", inquiryDate: "July 29, 2025", cra: "EXPERIAN" as const }
  ],
};

const exampleAccounts = [
  {
    creditorName: "NAVIENT / DEPT OF EDUCATION",
    accountNumber: "****7742",
    accountType: "Student Loan",
    balance: 34500,
    issues: [
      { code: "BALANCE_MISMATCH", description: "Balance shows $34,500 but I have records showing payoff in March 2025 through employer's student loan repayment program" },
      { code: "STATUS_INCORRECT", description: "Reports as 90 days past due but loan was in forbearance during that period" },
      { code: "PAYMENT_HISTORY_WRONG", description: "Shows 3 late payments in 2024 when all payments were made on time via auto-debit" }
    ]
  }
];

async function main() {
  try {
    const letter = await generateLetter({
      client: exampleClient,
      accounts: exampleAccounts,
      cra: "EXPERIAN",
      flow: "ACCURACY",
      round: 1,
      usedContentHashes: new Set(),
    });

    console.log("=".repeat(80));
    console.log("GENERATED LETTER - ACCURACY FLOW R1");
    console.log("Student Loan + 3 Hard Inquiries + Personal Info Removal");
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
    console.log("Content Hash:", letter.contentHash);
  } catch (error) {
    console.error("Error generating letter:", error);
  }
}

main();
