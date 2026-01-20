// CFPB Complaint Generator - Matches the voice and legal citations of each dispute letter
// These templates are designed to be copied directly into CFPB.gov "File a Complaint"

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

export interface CFPBComplaintData {
  clientName: string;
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  accounts: Array<{
    creditorName: string;
    accountNumber?: string;
    balance?: string;
    issue: string;
  }>;
  round: number;
  flow: DisputeFlow;
  previousDisputeDate?: string;
  daysSinceDispute?: number;
}

const CRA_FULL_NAMES: Record<string, string> = {
  TRANSUNION: "TransUnion",
  EXPERIAN: "Experian",
  EQUIFAX: "Equifax Information Services LLC",
};

// CFPB Product Categories
export const CFPB_PRODUCT = "Credit reporting or other personal consumer reports";
export const CFPB_SUB_PRODUCT = "Credit reporting";

// Generate account list for complaint
function formatAccountList(accounts: CFPBComplaintData["accounts"]): string {
  return accounts
    .map((acc, i) => {
      let line = `${i + 1}. ${acc.creditorName}`;
      if (acc.accountNumber) line += ` (Account: ${acc.accountNumber})`;
      if (acc.balance) line += ` - Balance: ${acc.balance}`;
      line += `\n   Issue: ${acc.issue}`;
      return line;
    })
    .join("\n\n");
}

// ============================================================================
// ACCURACY FLOW - CFPB COMPLAINTS (Matches each round's letter voice)
// ============================================================================

const ACCURACY_CFPB: Record<number, {
  issue: string;
  subIssue: string;
  narrative: (data: CFPBComplaintData, craName: string, accountList: string) => string;
  resolution: (craName: string) => string;
}> = {
  // R1: Factual Dispute - Initial verification request
  1: {
    issue: "Incorrect information on your report",
    subIssue: "Information belongs to someone else",
    narrative: (data, craName, accountList) => `I am filing this complaint because ${craName} is furnishing INACCURATE information on my credit report that is damaging my ability to obtain credit and support my family.

The information in this complaint reports DIFFERENT data across each consumer reporting agency. The Fair Credit Reporting Act (FCRA) requires ${craName} to report my credit with MAXIMUM POSSIBLE ACCURACY under 15 U.S.C. § 1681e(b). This standard requires CRAs to report information 100% consistently across agencies.

DISPUTED ACCOUNTS WITH INACCURATE INFORMATION:
${accountList}

I have sent a written dispute to ${craName} formally disputing these items and requesting investigation under 15 U.S.C. § 1681i. The FCRA gives ${craName} 30 days to either:
1. Verify the information with documentation, OR
2. Delete the inaccurate items from my report

The inaccurate reporting is causing me significant harm - I cannot obtain the credit I need, which forces me to work extra hours and lose time with my family. All of this stress is directly caused by ${craName}'s unreliable reporting.

I am requesting CFPB assistance to ensure ${craName} properly investigates these items and either corrects or deletes them as required by law.`,
    resolution: (craName) => `I demand that ${craName} immediately investigate these disputed items under 15 U.S.C. § 1681i and either verify them with documentation showing they are 100% accurate, or delete them from my credit report within 30 days. If ${craName} does not correct these items, I intend to seek damages for their violation of 15 U.S.C. § 1681e(b).`,
  },

  // R2: 15 USC 1681e(b) - Maximum accuracy violation, damages warning
  2: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `${craName} has BROKEN THE LAW and may owe me damages because they did not correct misleading information from my credit report after receiving my dispute over ${data.daysSinceDispute || 50} days ago.

On ${data.previousDisputeDate || "[DATE OF PREVIOUS DISPUTE]"}, I sent ${craName} a detailed dispute spelling out the EXACT accounts furnishing different information compared to other CRAs. On my credit report update, NO CHANGES WERE MADE.

Under 15 U.S.C. § 1681e(b), ${craName} MUST conduct reasonable procedures to assure MAXIMUM POSSIBLE ACCURACY. By failing to make any changes to my disputed items, ${craName} has clearly NOT followed reasonable procedures.

ACCOUNTS STILL REPORTING INACCURATELY:
${accountList}

I have attached screenshots proving these items report DIFFERENT information on ${craName} compared to other credit bureaus - confirming they are inaccurate according to the maximum accuracy standard of the FCRA.

I am owed ACTUAL DAMAGES because I have not been able to use my credit during this time. If ${craName} does not want me to seek a legal claim, they should delete the inaccurate information immediately.`,
    resolution: (craName) => `I demand that ${craName} delete all inaccurate information listed in this complaint. I have proof the items report differently across bureaus. Under 15 U.S.C. § 1681e(b), ${craName} must report with maximum accuracy. Their failure to correct these items after my dispute constitutes a violation for which I am entitled to actual damages.`,
  },

  // R3: 15 USC 1681i(a)(5) - 30-day deadline violation
  3: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Investigation took more than 30 days",
    narrative: (data, craName, accountList) => `${craName} has BROKEN THE LAW under 15 U.S.C. § 1681i(a)(5). I sent them a dispute highlighting EXACT accounts that are incorrect, and after 30+ days, the items REMAIN UNCHANGED on my credit report.

Under the FCRA, if a CRA receives a dispute and fails to verify the information within 30 days, the items MUST BE DELETED. ${craName} has violated this requirement MULTIPLE TIMES.

TIMELINE OF VIOLATIONS:
- Initial dispute sent: ${data.previousDisputeDate || "[DATE]"}
- Days elapsed: ${data.daysSinceDispute || "30+"} days
- Items corrected: NONE

ACCOUNTS THAT MUST BE DELETED:
${accountList}

I have now sent ${data.round} disputes over ${(data.round || 1) * 30}+ days. ${craName} has either failed to respond within the legal timeframe or responded with generic "verified" statements without any evidence.

I have gathered SIGNIFICANT DAMAGES from ${craName}'s violations. I will ONLY drop my complaint if they DELETE the items immediately. Otherwise, I am prepared to pursue this matter in federal court under 15 U.S.C. § 1681n (willful noncompliance) and § 1681o (negligent noncompliance).`,
    resolution: (craName) => `Under 15 U.S.C. § 1681i(a)(5), ${craName} was required to delete these items when they failed to verify them within 30 days. I demand IMMEDIATE DELETION of all disputed items. ${craName}'s repeated failure to comply constitutes willful noncompliance, entitling me to statutory damages of $100-$1,000 per violation, plus actual damages, punitive damages, and attorney's fees.`,
  },

  // R4: 15 USC 1681i(a)(1)(a) - No reasonable reinvestigation
  4: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `After extensive research, I have found information that proves ${craName} has put in MINIMAL EFFORT when investigating my disputes. If they do not delete these items, they will potentially owe me THOUSANDS in damages.

According to the 2019 court case Shepard v. Equifax Info. Servs., LLC, a CRA that does not conduct a REASONABLE INVESTIGATION - meaning going BEYOND just asking the data furnisher - violates 15 U.S.C. § 1681i(a)(1)(A).

I have sent ${craName} ${data.round} disputes over ${(data.round || 1) * 30}+ days. I know FOR A FACT that no investigation went beyond the data furnisher because I received the SAME PARROTING RESPONSE each time: either "Updated" or "Verified by data furnisher" with NO DETAILS or PROOF.

ACCOUNTS WITH NO REASONABLE INVESTIGATION:
${accountList}

The Shepard case proves that ${craName} legally MUST delete these items because they never conducted a reasonable investigation. I am prepared to use this case law in federal court if necessary.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681i(a)(1)(A) and the precedent set in Shepard v. Equifax (2019), ${craName} must conduct investigations that go BEYOND simply asking the furnisher. Their failure to do so means these items must be DELETED. I demand immediate deletion or I will pursue legal action citing this case law.`,
  },

  // R5: 15 USC 1681i(a)(7) - Demand for reinvestigation procedure description
  5: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Was not notified of investigation status or results",
    narrative: (data, craName, accountList) => `I informed ${craName} in my last dispute that the creditors cannot be trusted and requested they investigate BEYOND the data furnishers. Today I am demanding they prove whether they actually did this.

Under 15 U.S.C. § 1681i(a)(7), I have the RIGHT to request a DESCRIPTION OF THE REINVESTIGATION PROCEDURE. ${craName} has 15 DAYS to provide:

1. A statement that the reinvestigation was completed, including the NAME of the employee who conducted it and the DATE/TIME it was completed

2. ALL DOCUMENTS the furnishers submitted to prove the items are correct regarding: Account number, Account status, Date opened, High credit, Credit limit, Balance, Past due amount, Payment history, and Date of first delinquency

3. The FULL NAME, ADDRESS, and TELEPHONE NUMBER of each furnisher contacted

4. The ACDV response received from each furnisher, plus the EXACT STEPS taken after that to verify each category

ACCOUNTS REQUIRING VERIFICATION DOCUMENTATION:
${accountList}

If ${craName} cannot provide this documentation within 15 days, the items are considered UNVERIFIABLE and must be DELETED under 15 U.S.C. § 1681i(a)(5).`,
    resolution: (craName) => `Under 15 U.S.C. § 1681i(a)(7), ${craName} has 15 DAYS to provide me with a complete description of their reinvestigation procedure including employee details, all furnisher documents, contact information, and ACDV responses. Failure to provide this documentation means the items are UNVERIFIABLE and must be deleted immediately.`,
  },

  // R6: 15 USC 1681i(a)(6)(B) - Method of Verification demand
  6: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Was not notified of investigation status or results",
    narrative: (data, craName, accountList) => `I am demanding that ${craName} provide the METHOD OF VERIFICATION for my disputed items as required by 15 U.S.C. § 1681i(a)(6)(B)(iii).

Despite ${data.round} written disputes over several months, ${craName} has NEVER provided me with:
- HOW they verified the disputed information
- WHAT documents they reviewed
- WHO at the furnisher confirmed the data
- WHEN the verification was conducted

Under the FCRA, I have the LEGAL RIGHT to know the method of verification used. ${craName}'s failure to provide this information suggests they NEVER ACTUALLY VERIFIED these items - they just took the furnisher's word for it.

ACCOUNTS REQUIRING METHOD OF VERIFICATION:
${accountList}

If ${craName} cannot produce documentation showing HOW they verified each disputed data point, the items are UNVERIFIABLE and must be deleted.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681i(a)(6)(B)(iii), I demand ${craName} provide the specific METHOD OF VERIFICATION used for each disputed item. This must include what documents were reviewed, who verified the information, and when. Without this documentation, the items are unverifiable and must be deleted immediately.`,
  },

  // R7: 15 USC 1681i(c) - All accounts comprehensive
  7: {
    issue: "Incorrect information on your report",
    subIssue: "Account information incorrect",
    narrative: (data, craName, accountList) => `This is a COMPREHENSIVE DISPUTE of ALL ACCOUNTS on my ${craName} credit report under 15 U.S.C. § 1681i(c).

After ${data.round} disputes and months of trying to correct inaccurate information, I am now formally disputing EVERY ACCOUNT ${craName} is reporting. Their systematic failure to properly investigate my previous disputes demonstrates they cannot be trusted to report ANY of my information accurately.

Under 15 U.S.C. § 1681i(c), ${craName} must:
1. Promptly provide written notification of the dispute to each furnisher
2. Conduct a reasonable reinvestigation
3. Record the current status of the disputed information before any deletion

ALL ACCOUNTS DISPUTED:
${accountList}

I demand ${craName} reinvestigate EACH account listed above and provide verification documentation or delete them.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681i(c), I am disputing ALL accounts on my ${craName} report. Each account must be reinvestigated with proper documentation. Any account that cannot be verified with original documentation must be deleted immediately.`,
  },

  // R8: 15 USC 1681s-2(B) - Furnisher duties
  8: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `I am filing this complaint regarding ${craName}'s failure to enforce FURNISHER DUTIES under 15 U.S.C. § 1681s-2(b).

When a CRA receives a dispute, they must notify the furnisher. The FURNISHER then has legal duties under § 1681s-2(b) to:
1. Conduct an investigation
2. Review all relevant information provided
3. Report results back to the CRA
4. Modify, delete, or permanently block reporting if information is inaccurate

${craName} has received ${data.round} disputes from me. Either:
- They are NOT notifying furnishers as required, OR
- The furnishers are violating their duties, and ${craName} is ignoring it

ACCOUNTS WITH FURNISHER DUTY VIOLATIONS:
${accountList}

${craName} cannot hide behind furnishers. Under the FCRA, they are EQUALLY LIABLE for reporting unverified information.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681s-2(b), furnishers have legal duties when disputes are received. ${craName} must ensure furnishers comply or face liability themselves. I demand immediate investigation into whether furnisher duties were followed and deletion of any items where they were not.`,
  },

  // R9: 15 USC 1681s-2(b) - Furnisher investigation failure
  9: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `The furnishers of the accounts in this complaint have FAILED to conduct proper investigations as required by 15 U.S.C. § 1681s-2(b), and ${craName} continues to report this unverified information.

Under § 1681s-2(b)(1), upon receiving notice of a dispute from a CRA, a furnisher MUST:
(A) Conduct an investigation with respect to the disputed information
(B) Review ALL relevant information provided by the CRA
(C) Report the results of the investigation to the CRA
(D) If the disputed information is found to be inaccurate or incomplete, report those results to ALL CRAs to which they furnished the information

The furnishers have failed these duties, and ${craName} continues to report the disputed information anyway.

ACCOUNTS WITH FURNISHER INVESTIGATION FAILURES:
${accountList}

Both the furnishers AND ${craName} are now liable under the FCRA.`,
    resolution: (craName) => `The furnishers have violated 15 U.S.C. § 1681s-2(b) by failing to properly investigate. ${craName} is liable for continuing to report this unverified information. I demand immediate deletion of all items where furnisher duties were not properly fulfilled.`,
  },

  // R10: 15 USC 1681c(e) - Re-aging violation
  10: {
    issue: "Incorrect information on your report",
    subIssue: "Account status incorrect",
    narrative: (data, craName, accountList) => `${craName} is violating 15 U.S.C. § 1681c(e) by reporting RE-AGED accounts on my credit report.

Under the FCRA, the reporting period for negative information is calculated from the DATE OF FIRST DELINQUENCY. Creditors and CRAs are PROHIBITED from:
- Changing the date of first delinquency to extend the reporting period
- Resetting the 7-year clock through account transfers or sales
- Reporting accounts past the legal reporting period

The accounts listed below have been RE-AGED in violation of federal law:

ACCOUNTS WITH RE-AGING VIOLATIONS:
${accountList}

Re-aging is a SERIOUS FCRA violation that can result in statutory damages and punitive damages for willful noncompliance.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681c(e), ${craName} is prohibited from re-aging accounts. I demand immediate deletion of all accounts that have been re-aged or have exceeded the 7-year reporting period from the original date of first delinquency.`,
  },

  // R11: 1681e(b) - Discharged debt reporting
  11: {
    issue: "Incorrect information on your report",
    subIssue: "Account status incorrect",
    narrative: (data, craName, accountList) => `${craName} is violating 15 U.S.C. § 1681e(b) by reporting DISCHARGED DEBTS with balances on my credit report.

When a debt is discharged in bankruptcy or otherwise legally discharged, it is ILLEGAL to:
- Report a balance on a discharged debt
- Report the debt as "owed" or "past due"
- Continue collection activity on the debt

The accounts below are DISCHARGED DEBTS that ${craName} is improperly reporting:

DISCHARGED ACCOUNTS IMPROPERLY REPORTED:
${accountList}

Reporting balances on discharged debts violates both the FCRA's maximum accuracy requirement and potentially the bankruptcy discharge injunction.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681e(b), ${craName} must report with maximum accuracy. Reporting balances on discharged debts is inaccurate and potentially violates bankruptcy law. I demand immediate correction to show $0 balance and "Discharged" status, or complete deletion.`,
  },
};

// ============================================================================
// COLLECTION FLOW - CFPB COMPLAINTS (Matches collection letter voice)
// ============================================================================

const COLLECTION_CFPB: Record<number, {
  issue: string;
  subIssue: string;
  narrative: (data: CFPBComplaintData, craName: string, accountList: string) => string;
  resolution: (craName: string) => string;
}> = {
  // R1: 15 USC 1692g - No dunning letter within 5 days
  1: {
    issue: "Incorrect information on your report",
    subIssue: "Account status incorrect",
    narrative: (data, craName, accountList) => `The debt collectors reporting to ${craName} have violated 15 U.S.C. § 1692g by furnishing collection accounts WITHOUT validating the debts with me beforehand.

Under the Fair Debt Collection Practices Act (FDCPA), a debt collector MUST send a DUNNING LETTER within 5 days of initial communication. Reporting to a credit bureau IS an initial communication. These collectors NEVER sent me dunning letters before reporting.

If I had received dunning letters, I would have disputed these debts immediately. The ONLY reason I know about these accounts is because they appeared on my credit report - which proves no dunning letter was ever sent.

COLLECTION ACCOUNTS REPORTED WITHOUT VALIDATION:
${accountList}

This is DEBT PARKING - placing collection accounts on credit reports without following proper validation procedures. It is ILLEGAL.

${craName} can avoid liability by either:
1. Producing PROOF that dunning letters were sent to my address within 5 days of reporting, OR
2. DELETING these illegal collection accounts immediately`,
    resolution: (craName) => `Under 15 U.S.C. § 1692g, debt collectors must send dunning letters within 5 days of initial communication (including credit reporting). These collectors never validated these debts. I demand ${craName} produce proof of dunning letters or DELETE these accounts immediately.`,
  },

  // R2: 15 USC 1692g(b) - Furnishing unverified disputed info
  2: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `The collection accounts in this complaint are FURNISHING ILLEGALLY under 15 U.S.C. § 1692g(b).

I disputed these invalidated debts approximately ${data.daysSinceDispute || 60} days ago. Since then, I have NOT received ANY verification from the debt collectors. Under 15 U.S.C. § 1692g(b), a debt collector who receives a dispute MUST:
1. CEASE all collection activity (including credit reporting) until verification is provided
2. Obtain verification of the debt
3. Mail verification to the consumer

This was proven in Semper v. JBC Legal Group, 2005 U.S. Dist. - a debt collector who does not verify a disputed debt must CEASE ALL COLLECTION ACTION including credit reporting.

UNVERIFIED COLLECTION ACCOUNTS:
${accountList}

${craName} may think they cannot be punished under the FDCPA because they are a CRA. However, they ARE liable under the FCRA - specifically 15 U.S.C. § 1681i(a)(5) which requires deletion of UNVERIFIABLE information.

Black's Law Dictionary defines "verification" as an AFFIDAVIT or SWORN DECLARATION. Unless ${craName} can produce a SWORN DOCUMENT proving these debts are due and owing, they MUST be deleted.`,
    resolution: (craName) => `Under 15 U.S.C. § 1692g(b) and Semper v. JBC Legal Group, debt collectors must cease collection activity on disputed debts until verified. Under 15 U.S.C. § 1681i(a)(5), ${craName} must delete unverifiable information. I demand immediate deletion of all unverified collection accounts.`,
  },

  // R3: Continued violations
  3: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `This is my THIRD dispute regarding these illegal collection accounts. ${craName} and the debt collectors continue to violate federal law.

DOCUMENTED VIOLATIONS:
1. 15 U.S.C. § 1692g - No dunning letters sent within 5 days
2. 15 U.S.C. § 1692g(b) - Continued reporting after dispute without verification
3. 15 U.S.C. § 1681i(a)(5) - Failure to delete unverifiable information
4. 15 U.S.C. § 1681e(b) - Failure to ensure maximum accuracy

COLLECTION ACCOUNTS IN CONTINUED VIOLATION:
${accountList}

I have provided ${craName} with ${data.round} written disputes documenting these violations. Their continued failure to act constitutes WILLFUL NONCOMPLIANCE under 15 U.S.C. § 1681n.`,
    resolution: (craName) => `After multiple disputes, ${craName} continues to report these illegal collection accounts. Their willful noncompliance under 15 U.S.C. § 1681n entitles me to statutory damages. I demand IMMEDIATE deletion or I will pursue legal action.`,
  },

  // R4: Final warning
  4: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `This is my FINAL WARNING before pursuing legal action against ${craName} and the debt collectors.

I have sent ${data.round} disputes over ${(data.round || 1) * 30}+ days. The collection accounts remain on my report despite:
- NO dunning letters ever being sent
- NO verification being provided after my disputes
- MULTIPLE FCRA and FDCPA violations documented

ACCOUNTS FOR WHICH I AM CALCULATING DAMAGES:
${accountList}

I am now preparing to file a lawsuit in federal court seeking:
- Statutory damages under 15 U.S.C. § 1681n: $100-$1,000 per violation
- Actual damages for denied credit, higher interest rates, etc.
- Punitive damages for willful violations
- Attorney's fees and costs

This complaint to the CFPB serves as FINAL NOTICE.`,
    resolution: (craName) => `This is my final demand. ${craName} must DELETE all disputed collection accounts within 15 days or I will file a lawsuit in federal court seeking all damages available under 15 U.S.C. § 1681n and the FDCPA.`,
  },
};

// ============================================================================
// CONSENT FLOW - CFPB COMPLAINTS (Matches consent letter voice)
// ============================================================================

const CONSENT_CFPB: Record<number, {
  issue: string;
  subIssue: string;
  narrative: (data: CFPBComplaintData, craName: string, accountList: string) => string;
  resolution: (craName: string) => string;
}> = {
  // R1: 15 USC 1681b(a)(2) - No permissible purpose
  1: {
    issue: "Improper use of your report",
    subIssue: "Reporting company used your report improperly",
    narrative: (data, craName, accountList) => `${craName} has VIOLATED MY PRIVACY RIGHTS by reporting accounts WITHOUT my written authorization or permissible purpose as required by 15 U.S.C. § 1681b(a)(2).

This is a SERIOUS violation involving:
- Invasion of privacy
- Willful neglect
- Furnishing information with intention to damage my personal image
- Potential DEFAMATION OF CHARACTER

I NEVER consented to these accounts being placed on my credit report. Under the FCRA, ${craName} MUST have a permissible purpose to report consumer information. Valid permissible purposes require either:
1. Written consent from the consumer, OR
2. A legitimate business transaction initiated by the consumer

ACCOUNTS REPORTED WITHOUT PERMISSIBLE PURPOSE:
${accountList}

Unless ${craName} can produce a SIGNED AGREEMENT between me and them showing MUTUAL ASSENT (signatures from BOTH parties - mandatory for a valid contract), they are GUILTY of releasing my information without permissible purpose.

I have been unable to use my credit for months because of these illegal accounts. I cannot move apartments, buy a car, or get a simple credit card.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681b(a)(2), ${craName} must have permissible purpose to report my information. I NEVER gave written consent. I demand ${craName} produce a signed agreement showing my consent or DELETE these accounts immediately. I am prepared to seek damages for defamation of character in addition to FCRA violations.`,
  },

  // R2: 15 USC 1681a(4) - Definition challenge
  2: {
    issue: "Improper use of your report",
    subIssue: "Reporting company used your report improperly",
    narrative: (data, craName, accountList) => `${craName} continues to report accounts without permissible purpose in violation of 15 U.S.C. § 1681a(4) and § 1681b(a)(2).

Under 15 U.S.C. § 1681a(4), a "consumer reporting agency" is defined as any entity that assembles or evaluates consumer credit information for the purpose of furnishing consumer reports to third parties. This REQUIRES that information be obtained and reported LAWFULLY.

${craName} has failed to establish they obtained my information lawfully. They have NOT produced:
- Any signed authorization from me
- Any proof of a transaction I initiated
- Any legitimate permissible purpose

ACCOUNTS REPORTED WITHOUT LEGAL BASIS:
${accountList}

My previous dispute put ${craName} on notice. Their continued reporting without lawful basis constitutes WILLFUL NONCOMPLIANCE.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681a(4), ${craName}'s authority to report requires lawful collection of information. They have NO lawful basis to report these accounts. I demand immediate deletion and documentation that this information will not be re-reported.`,
  },

  // R3: Final notice - 15 USC 1681a(d)(a)(2)(B)
  3: {
    issue: "Improper use of your report",
    subIssue: "Reporting company used your report improperly",
    narrative: (data, craName, accountList) => `This is my FINAL NOTICE before pursuing legal action for ${craName}'s violations of my consent and privacy rights.

I have documented violations of:
- 15 U.S.C. § 1681b(a)(2) - Reporting without permissible purpose
- 15 U.S.C. § 1681a(4) - Definition of lawful consumer reporting
- 15 U.S.C. § 1681a(d)(a)(2)(B) - Requirements for inclusion in consumer reports

ACCOUNTS REPORTED WITHOUT MY CONSENT:
${accountList}

${craName} has had ${data.round} opportunities to either:
1. Produce my written consent, OR
2. Delete these unauthorized accounts

They have done NEITHER. I am now prepared to file a lawsuit seeking:
- Damages for invasion of privacy
- Damages for defamation of character
- FCRA statutory damages ($100-$1,000 per violation)
- Punitive damages for willful noncompliance
- Attorney's fees

This CFPB complaint is my final attempt at resolution before litigation.`,
    resolution: (craName) => `This is my FINAL DEMAND. ${craName} must DELETE all unauthorized accounts within 15 days. Their continued reporting without my consent constitutes invasion of privacy and defamation. I will pursue all available legal remedies including FCRA damages and state law claims.`,
  },
};

// ============================================================================
// COMBO FLOW - CFPB COMPLAINTS (Combines accuracy and collection voice)
// ============================================================================

const COMBO_CFPB: Record<number, {
  issue: string;
  subIssue: string;
  narrative: (data: CFPBComplaintData, craName: string, accountList: string) => string;
  resolution: (craName: string) => string;
}> = {
  1: {
    issue: "Incorrect information on your report",
    subIssue: "Account information incorrect",
    narrative: (data, craName, accountList) => `${craName} is facing MULTIPLE legal violations. They are furnishing BOTH inaccurate information AND invalidated collection accounts on my credit report.

VIOLATION TYPE 1 - ACCURACY (15 U.S.C. § 1681e(b)):
The accounts below report DIFFERENT information across credit bureaus. The FCRA requires MAXIMUM POSSIBLE ACCURACY - meaning 100% consistency.

VIOLATION TYPE 2 - COLLECTION (15 U.S.C. § 1692g):
The collection accounts were placed on my report WITHOUT proper debt validation. No dunning letters were sent within 5 days of reporting.

ACCOUNTS WITH DUAL VIOLATIONS:
${accountList}

${craName} must either:
1. PROVE the accuracy of each disputed item with documentation AND produce dunning letters, OR
2. DELETE all items immediately

I have documented all inaccurate information with screenshots showing discrepancies across bureaus. The debt collectors have committed DEBT PARKING by reporting without validation.`,
    resolution: (craName) => `I demand ${craName} address BOTH types of violations: (1) Delete or correct all inaccurate items under 15 U.S.C. § 1681e(b), AND (2) Delete all collection accounts that lack proper validation under 15 U.S.C. § 1692g. Failure to address both issues will result in legal action.`,
  },

  2: {
    issue: "Problem with a credit reporting company's investigation into an existing problem",
    subIssue: "Their investigation did not fix an error on your report",
    narrative: (data, craName, accountList) => `${craName} has BROKEN MULTIPLE LAWS by failing to correct inaccurate information AND continuing to report unverified collection debts.

ACCURACY VIOLATION - 15 U.S.C. § 1681e(b):
I sent my initial dispute ${data.daysSinceDispute || 50}+ days ago with PROOF that items report differently across bureaus. NO CHANGES were made.

COLLECTION VIOLATION - 15 U.S.C. § 1692g(b):
The collection accounts remain despite NO VERIFICATION being provided. Under Semper v. JBC Legal Group, unverified disputed debts cannot be reported.

ACCOUNTS WITH CONTINUED VIOLATIONS:
${accountList}

I have attached evidence showing:
1. Screenshots proving accuracy discrepancies across bureaus
2. Documentation that no debt validation was ever received

${craName} is liable under BOTH the FCRA and FDCPA.`,
    resolution: (craName) => `Under 15 U.S.C. § 1681e(b) and § 1692g(b), ${craName} must delete all inaccurate items AND all unverified collection accounts. I demand immediate action on BOTH categories or I will pursue damages under both statutes.`,
  },
};

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

export function generateCFPBComplaint(data: CFPBComplaintData): {
  product: string;
  subProduct: string;
  issue: string;
  subIssue: string;
  companyName: string;
  narrative: string;
  desiredResolution: string;
} {
  const craName = CRA_FULL_NAMES[data.cra];
  const accountList = formatAccountList(data.accounts);

  // Get flow-specific templates
  let templates: Record<number, {
    issue: string;
    subIssue: string;
    narrative: (data: CFPBComplaintData, craName: string, accountList: string) => string;
    resolution: (craName: string) => string;
  }>;

  switch (data.flow) {
    case "ACCURACY":
      templates = ACCURACY_CFPB;
      break;
    case "COLLECTION":
      templates = COLLECTION_CFPB;
      break;
    case "CONSENT":
      templates = CONSENT_CFPB;
      break;
    case "COMBO":
      templates = COMBO_CFPB;
      break;
    default:
      templates = ACCURACY_CFPB;
  }

  // Get round-specific template (fall back to highest available if round exceeds)
  const availableRounds = Object.keys(templates).map(Number).sort((a, b) => b - a);
  const roundKey = availableRounds.find((r) => r <= data.round) || availableRounds[0];
  const template = templates[roundKey];

  return {
    product: CFPB_PRODUCT,
    subProduct: CFPB_SUB_PRODUCT,
    issue: template.issue,
    subIssue: template.subIssue,
    companyName: craName,
    narrative: template.narrative(data, craName, accountList),
    desiredResolution: template.resolution(craName),
  };
}

// Generate a formatted complaint ready for copy/paste
export function formatCFPBComplaintForCopy(data: CFPBComplaintData): string {
  const complaint = generateCFPBComplaint(data);

  return `════════════════════════════════════════════════════════════════
CFPB COMPLAINT - READY TO FILE AT CONSUMERFINANCE.GOV/COMPLAINT
════════════════════════════════════════════════════════════════

STEP 1: SELECT PRODUCT
────────────────────────────────────────────────────────────────
Product: ${complaint.product}
Sub-product: ${complaint.subProduct}

STEP 2: SELECT ISSUE
────────────────────────────────────────────────────────────────
Issue: ${complaint.issue}
Sub-issue: ${complaint.subIssue}

STEP 3: COMPANY INFORMATION
────────────────────────────────────────────────────────────────
Company Name: ${complaint.companyName}

STEP 4: WHAT HAPPENED? (Copy everything below this line)
────────────────────────────────────────────────────────────────
${complaint.narrative}

STEP 5: DESIRED RESOLUTION (Copy everything below this line)
────────────────────────────────────────────────────────────────
${complaint.desiredResolution}

════════════════════════════════════════════════════════════════
IMPORTANT FILING INSTRUCTIONS:
────────────────────────────────────────────────────────────────
1. Go to: https://www.consumerfinance.gov/complaint/
2. Click "Start a new complaint"
3. Select "Credit reporting or other personal consumer reports"
4. Follow the prompts using the information above
5. Copy/paste the narrative and resolution into the appropriate fields
6. Attach any supporting documents (dispute letters, screenshots)
7. SAVE YOUR CONFIRMATION NUMBER

The company has 15 days to respond to CFPB complaints.
You can track your complaint at the CFPB website.
════════════════════════════════════════════════════════════════`;
}
