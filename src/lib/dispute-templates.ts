// Dispute Letter Templates for each CRA

export interface AccountIssue {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  suggestedFlow: string;
  fcraSection?: string;
}

export interface DisputeAccountData {
  creditorName: string;
  accountNumber: string;
  accountType?: string;
  accountStatus?: string;
  balance: string;
  pastDue?: string;
  dateOpened?: string;
  dateReported?: string;
  paymentStatus?: string;
  reason: string;
  fcraViolation: string;
  issues?: AccountIssue[];
}

export interface DisputeLetterData {
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  clientSSN4: string;
  clientDOB: string;
  currentDate: string;
  round?: number;
  accounts: DisputeAccountData[];
  // Round-specific data
  previousDisputeDate?: string;
  previousResponseSummary?: string;
  cfpbComplaintNumber?: string;
  daysWaitedForResponse?: number;
}

// Map issue codes to FCRA sections
export const FCRA_SECTIONS: Record<string, { section: string; title: string; description: string }> = {
  DEROGATORY_CHARGEOFF: {
    section: "15 U.S.C. § 1681e(b)",
    title: "Maximum Possible Accuracy",
    description: "CRAs must follow reasonable procedures to assure maximum possible accuracy",
  },
  DEROGATORY_COLLECTION: {
    section: "15 U.S.C. § 1681s-2(b)",
    title: "Duties of Furnishers Upon Notice of Dispute",
    description: "Furnishers must investigate and report results of investigation",
  },
  LATE_PAYMENT_SEVERE: {
    section: "15 U.S.C. § 1681i(a)",
    title: "Reinvestigation Required",
    description: "CRA must conduct reasonable reinvestigation within 30 days",
  },
  LATE_PAYMENT_MODERATE: {
    section: "15 U.S.C. § 1681e(b)",
    title: "Maximum Possible Accuracy",
    description: "Information must be accurate and complete",
  },
  PAST_DUE_AMOUNT: {
    section: "15 U.S.C. § 1681s-2(a)(1)",
    title: "Duty to Provide Accurate Information",
    description: "Furnishers must not report information known to be inaccurate",
  },
  BALANCE_INCONSISTENCY: {
    section: "15 U.S.C. § 1681e(b)",
    title: "Maximum Possible Accuracy",
    description: "Balance discrepancies indicate procedural failures",
  },
  STATUS_INCONSISTENCY: {
    section: "15 U.S.C. § 1681e(b)",
    title: "Maximum Possible Accuracy",
    description: "Status must be consistently and accurately reported",
  },
  DATE_INCONSISTENCY: {
    section: "15 U.S.C. § 1681c(a)",
    title: "Information Excluded from Reports",
    description: "Date discrepancies may affect reporting period compliance",
  },
  OUTDATED_ACCOUNT: {
    section: "15 U.S.C. § 1681c(a)(4)",
    title: "Obsolete Information",
    description: "Accounts older than 7 years must be removed",
  },
  MISSING_REQUIRED_FIELDS: {
    section: "15 U.S.C. § 1681e(b)",
    title: "Maximum Possible Accuracy",
    description: "Incomplete information fails accuracy standards",
  },
  STUDENT_LOAN_STATUS: {
    section: "15 U.S.C. § 1681s-2(a)(1)(A)",
    title: "Duty to Provide Accurate Information",
    description: "Student loan status must be accurately reported",
  },
  MEDICAL_DEBT_RESTRICTION: {
    section: "15 U.S.C. § 1681c(a)(6)",
    title: "Medical Debt Restrictions",
    description: "Certain medical debts have reporting restrictions",
  },
};

export const CRA_ADDRESSES = {
  TRANSUNION: {
    name: "TransUnion",
    address: "P.O. Box 2000",
    city: "Chester",
    state: "PA",
    zip: "19016-2000",
  },
  EXPERIAN: {
    name: "Experian",
    address: "P.O. Box 4500",
    city: "Allen",
    state: "TX",
    zip: "75013",
  },
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address: "P.O. Box 740256",
    city: "Atlanta",
    state: "GA",
    zip: "30374-0256",
  },
};

// Generate detailed account section with all issues and violations
function generateDetailedAccountSection(accounts: DisputeAccountData[]): string {
  return accounts
    .map((acc, idx) => {
      const lines = [
        `ACCOUNT ${idx + 1}:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Creditor/Furnisher: ${acc.creditorName}`,
        `Account Number: ${acc.accountNumber}`,
      ];

      if (acc.accountType) lines.push(`Account Type: ${acc.accountType}`);
      if (acc.accountStatus) lines.push(`Account Status: ${acc.accountStatus}`);
      lines.push(`Reported Balance: ${acc.balance}`);
      if (acc.pastDue && acc.pastDue !== "N/A" && acc.pastDue !== "$0") {
        lines.push(`Past Due Amount: ${acc.pastDue}`);
      }
      if (acc.dateOpened) lines.push(`Date Opened: ${acc.dateOpened}`);
      if (acc.dateReported) lines.push(`Date Last Reported: ${acc.dateReported}`);
      if (acc.paymentStatus) lines.push(`Payment Status: ${acc.paymentStatus}`);

      lines.push("");
      lines.push(`DISPUTE REASON: ${acc.reason}`);
      lines.push("");
      lines.push(`FCRA VIOLATION: ${acc.fcraViolation}`);

      // Add detailed issues if available
      if (acc.issues && acc.issues.length > 0) {
        lines.push("");
        lines.push("IDENTIFIED ISSUES:");
        acc.issues.forEach((issue, issueIdx) => {
          const fcraInfo = FCRA_SECTIONS[issue.code];
          lines.push(`  ${issueIdx + 1}. ${issue.description}`);
          lines.push(`     Severity: ${issue.severity}`);
          if (fcraInfo) {
            lines.push(`     Legal Basis: ${fcraInfo.section} - ${fcraInfo.title}`);
          } else if (issue.fcraSection) {
            lines.push(`     Legal Basis: ${issue.fcraSection}`);
          }
        });
      }

      lines.push("");
      return lines.join("\n");
    })
    .join("\n");
}

// Collect all unique FCRA sections cited
function collectFCRASections(accounts: DisputeAccountData[]): string[] {
  const sections = new Set<string>();

  accounts.forEach((acc) => {
    if (acc.issues) {
      acc.issues.forEach((issue) => {
        const fcraInfo = FCRA_SECTIONS[issue.code];
        if (fcraInfo) {
          sections.add(`${fcraInfo.section} - ${fcraInfo.title}`);
        }
      });
    }
  });

  // Always include base sections
  sections.add("15 U.S.C. § 1681e(b) - Maximum Possible Accuracy");
  sections.add("15 U.S.C. § 1681i - Procedure in Case of Disputed Accuracy");

  return Array.from(sections);
}

export function generateDisputeLetter(
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
  data: DisputeLetterData,
  flow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO"
): string {
  const craInfo = CRA_ADDRESSES[cra];
  const accountsList = generateDetailedAccountSection(data.accounts);
  const fcraReferences = collectFCRASections(data.accounts);
  const round = data.round || 1;

  // For rounds 2+, use escalation letters
  if (round >= 2) {
    return generateRoundSpecificLetter(craInfo, data, accountsList, fcraReferences, round, flow);
  }

  // Round 1 letters based on flow
  if (flow === "ACCURACY") {
    return generateAccuracyLetter(craInfo, data, accountsList, fcraReferences);
  } else if (flow === "COLLECTION") {
    return generateCollectionLetter(craInfo, data, accountsList, fcraReferences);
  } else if (flow === "COMBO") {
    return generateComboLetter(craInfo, data, accountsList, fcraReferences);
  } else {
    return generateConsentLetter(craInfo, data, accountsList, fcraReferences);
  }
}

// Round 2+ escalation letters
function generateRoundSpecificLetter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraReferences: string[],
  round: number,
  flow: string
): string {
  const fcraList = fcraReferences.map((ref) => `• ${ref}`).join("\n");

  if (round === 2) {
    return generateRound2Letter(craInfo, data, accountsList, fcraList);
  } else if (round === 3) {
    return generateRound3Letter(craInfo, data, accountsList, fcraList);
  } else {
    return generateRound4PlusLetter(craInfo, data, accountsList, fcraList, round);
  }
}

// Round 2: Method of Verification Demand
function generateRound2Letter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraList: string
): string {
  return `${data.clientName}
${data.clientAddress}
${data.clientCity}, ${data.clientState} ${data.clientZip}

${data.currentDate}

${craInfo.name}
${craInfo.address}
${craInfo.city}, ${craInfo.state} ${craInfo.zip}

Re: SECOND DISPUTE - Demand for Method of Verification (Round 2)
SSN: XXX-XX-${data.clientSSN4}
DOB: ${data.clientDOB}
${data.previousDisputeDate ? `Previous Dispute Date: ${data.previousDisputeDate}` : ""}

SENT VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED

To Whom It May Concern:

This is my SECOND formal dispute regarding the items listed below. I previously disputed these items${data.previousDisputeDate ? ` on ${data.previousDisputeDate}` : ""}, and your response indicated you "verified" the information as accurate. I am now demanding the METHOD OF VERIFICATION as is my right under federal law.

════════════════════════════════════════════════════════════════════════════════
                    DEMAND FOR METHOD OF VERIFICATION
════════════════════════════════════════════════════════════════════════════════

Under 15 U.S.C. § 1681i(a)(6)(B)(iii), upon request, you are REQUIRED to provide me with a description of the procedure used to determine the accuracy of the disputed information, including:

1. The business name, address, and telephone number of any furnisher contacted
2. The specific documents or records reviewed during reinvestigation
3. The method used to verify each disputed item
4. The date(s) verification was conducted
5. The name of the person who conducted the verification

════════════════════════════════════════════════════════════════════════════════
                      ACCOUNTS REQUIRING VERIFICATION
════════════════════════════════════════════════════════════════════════════════

${accountsList}
════════════════════════════════════════════════════════════════════════════════
                         LEGAL BASIS FOR THIS DEMAND
════════════════════════════════════════════════════════════════════════════════

${fcraList}
• 15 U.S.C. § 1681i(a)(6) - Method of Verification Disclosure Required
• 15 U.S.C. § 1681i(a)(1) - Reasonable Reinvestigation Standard

INADEQUATE INVESTIGATION CONCERNS:

I have reason to believe that your "verification" consisted merely of an automated response from the furnisher without any meaningful investigation. Under Cushman v. Trans Union Corp., 115 F.3d 220 (3d Cir. 1997), a CRA cannot satisfy its reinvestigation obligation by merely "parroting" information from the furnisher.

If you cannot provide documented proof of the specific verification procedures used, this indicates a failure to conduct a "reasonable" reinvestigation as required by § 1681i(a)(1).

════════════════════════════════════════════════════════════════════════════════
                              REQUIRED ACTIONS
════════════════════════════════════════════════════════════════════════════════

Within 15 days of receipt of this letter, you must:

1. Provide the complete Method of Verification for each disputed item
2. Identify all documents reviewed during reinvestigation
3. Provide contact information for all furnishers contacted
4. If you cannot provide this information, DELETE the disputed items immediately

NOTICE: Failure to provide the Method of Verification or delete the disputed items may constitute willful noncompliance under 15 U.S.C. § 1681n, subjecting you to statutory damages of $100-$1,000, punitive damages, and attorney's fees.

${data.cfpbComplaintNumber ? `\nCFPB Complaint Reference: ${data.cfpbComplaintNumber}\n` : ""}
I am maintaining detailed records of this dispute process for potential legal action.

Sincerely,


_______________________________
${data.clientName}

Enclosures:
- Copy of previous dispute letter
- Copy of your verification response
- Copy of government-issued ID
- Proof of current address

cc: Consumer Financial Protection Bureau
    Federal Trade Commission
`;
}

// Round 3: Procedural Violation Notice
function generateRound3Letter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraList: string
): string {
  return `${data.clientName}
${data.clientAddress}
${data.clientCity}, ${data.clientState} ${data.clientZip}

${data.currentDate}

${craInfo.name}
${craInfo.address}
${craInfo.city}, ${craInfo.state} ${craInfo.zip}

Re: THIRD DISPUTE - Notice of FCRA Violations and Intent to Pursue Remedies (Round 3)
SSN: XXX-XX-${data.clientSSN4}
DOB: ${data.clientDOB}

SENT VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED

To Whom It May Concern:

This is my THIRD formal dispute regarding the items listed below. Despite my previous disputes, you have failed to conduct a reasonable investigation as required by federal law. This letter serves as FORMAL NOTICE of your FCRA violations and my intent to pursue all available legal remedies.

════════════════════════════════════════════════════════════════════════════════
                      NOTICE OF FCRA VIOLATIONS
════════════════════════════════════════════════════════════════════════════════

Your handling of my disputes has violated the Fair Credit Reporting Act in the following ways:

1. FAILURE TO CONDUCT REASONABLE REINVESTIGATION
   Violation: 15 U.S.C. § 1681i(a)(1)(A)
   Your investigation appears to have been a mere "rubber stamp" of furnisher claims
   without independent verification of disputed information.

2. FAILURE TO PROVIDE METHOD OF VERIFICATION
   Violation: 15 U.S.C. § 1681i(a)(6)(B)(iii)
   You have failed to adequately describe the procedures used to verify disputed items.

3. FAILURE TO MAINTAIN MAXIMUM POSSIBLE ACCURACY
   Violation: 15 U.S.C. § 1681e(b)
   By continuing to report unverified information, you are failing to follow
   reasonable procedures to assure maximum possible accuracy.

════════════════════════════════════════════════════════════════════════════════
                         DISPUTED ACCOUNTS
════════════════════════════════════════════════════════════════════════════════

${accountsList}
════════════════════════════════════════════════════════════════════════════════
                         LEGAL AUTHORITY
════════════════════════════════════════════════════════════════════════════════

${fcraList}
• 15 U.S.C. § 1681n - Civil Liability for Willful Noncompliance
• 15 U.S.C. § 1681o - Civil Liability for Negligent Noncompliance

════════════════════════════════════════════════════════════════════════════════
                    DAMAGES AND REMEDIES AVAILABLE
════════════════════════════════════════════════════════════════════════════════

Under 15 U.S.C. § 1681n (Willful Noncompliance), I may be entitled to:
• Actual damages sustained
• Statutory damages of $100 to $1,000 PER VIOLATION
• Punitive damages as the court may allow
• Attorney's fees and costs

Under 15 U.S.C. § 1681o (Negligent Noncompliance), I may be entitled to:
• Actual damages sustained
• Attorney's fees and costs

════════════════════════════════════════════════════════════════════════════════
                         FINAL DEMAND
════════════════════════════════════════════════════════════════════════════════

This is your FINAL OPPORTUNITY to resolve this matter without litigation.

Within 15 days of receipt, you must EITHER:
1. DELETE all disputed items from my credit report, OR
2. Provide COMPLETE documentation proving the accuracy of each item

If you fail to take corrective action within 15 days, I will:
• File a formal complaint with the Consumer Financial Protection Bureau
• File a complaint with my State Attorney General
• Consult with an FCRA attorney regarding litigation
• Pursue all statutory and actual damages available under law

${data.cfpbComplaintNumber ? `\nCFPB Complaint Already Filed: ${data.cfpbComplaintNumber}\n` : ""}
This letter and all previous correspondence are being preserved as evidence.

Sincerely,


_______________________________
${data.clientName}

Enclosures:
- Copies of all previous dispute correspondence
- Timeline of dispute history
- Copy of government-issued ID
- Documentation of damages (if applicable)

cc: Consumer Financial Protection Bureau
    Federal Trade Commission
    State Attorney General - Consumer Protection Division
`;
}

// Round 4+: Final Demand / Intent to Litigate
function generateRound4PlusLetter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraList: string,
  round: number
): string {
  return `${data.clientName}
${data.clientAddress}
${data.clientCity}, ${data.clientState} ${data.clientZip}

${data.currentDate}

${craInfo.name}
LEGAL DEPARTMENT
${craInfo.address}
${craInfo.city}, ${craInfo.state} ${craInfo.zip}

Re: FINAL DEMAND BEFORE LITIGATION - Dispute Round ${round}
SSN: XXX-XX-${data.clientSSN4}
DOB: ${data.clientDOB}

SENT VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED

ATTENTION: LEGAL DEPARTMENT / GENERAL COUNSEL

To Whom It May Concern:

This is my FINAL DEMAND before initiating litigation under the Fair Credit Reporting Act. I have disputed the items listed below on ${round - 1} previous occasions, and you have consistently failed to conduct a reasonable investigation or provide adequate verification as required by federal law.

════════════════════════════════════════════════════════════════════════════════
                    FINAL DEMAND BEFORE LITIGATION
════════════════════════════════════════════════════════════════════════════════

This letter constitutes a FINAL DEMAND for immediate resolution. Your repeated failures to properly investigate my disputes constitute WILLFUL NONCOMPLIANCE with the Fair Credit Reporting Act.

════════════════════════════════════════════════════════════════════════════════
                         DISPUTED ACCOUNTS
════════════════════════════════════════════════════════════════════════════════

${accountsList}
════════════════════════════════════════════════════════════════════════════════
                    DOCUMENTED FCRA VIOLATIONS
════════════════════════════════════════════════════════════════════════════════

The following violations have been documented through ${round - 1} rounds of disputes:

${fcraList}
• 15 U.S.C. § 1681n - Willful Noncompliance (multiple violations)
• 15 U.S.C. § 1681o - Negligent Noncompliance
• Potential state law violations

════════════════════════════════════════════════════════════════════════════════
                         DAMAGES CALCULATION
════════════════════════════════════════════════════════════════════════════════

STATUTORY DAMAGES under 15 U.S.C. § 1681n:
• Minimum: $100 per violation × ${data.accounts.length} accounts × ${round - 1} rounds = $${100 * data.accounts.length * (round - 1)} minimum
• Maximum: $1,000 per violation × ${data.accounts.length} accounts × ${round - 1} rounds = $${(1000 * data.accounts.length * (round - 1)).toLocaleString()} maximum

ADDITIONAL DAMAGES may include:
• Actual damages (denied credit, higher interest rates, emotional distress)
• Punitive damages for willful violations
• Attorney's fees and court costs
• State consumer protection law damages

════════════════════════════════════════════════════════════════════════════════
                         SETTLEMENT DEMAND
════════════════════════════════════════════════════════════════════════════════

To avoid litigation, you must complete ALL of the following within 10 DAYS:

1. DELETE all disputed items from my credit report
2. Provide written confirmation of deletion
3. Provide corrected credit report showing deletions

If these conditions are not met within 10 days, I will:

✓ FILE FEDERAL LAWSUIT under the Fair Credit Reporting Act
✓ SEEK ALL STATUTORY AND ACTUAL DAMAGES
✓ SEEK PUNITIVE DAMAGES for willful noncompliance
✓ SEEK ATTORNEY'S FEES AND COSTS
✓ FILE COMPLAINTS with CFPB, FTC, and State Attorney General

I have retained copies of all correspondence as evidence and am prepared to proceed with litigation.

${data.cfpbComplaintNumber ? `CFPB Complaint Number: ${data.cfpbComplaintNumber}\n` : ""}

Time is of the essence. Govern yourself accordingly.

Sincerely,


_______________________________
${data.clientName}

Enclosures:
- Complete dispute history and timeline
- Copies of all previous correspondence
- Documentation of damages
- Copy of government-issued ID

cc: Consumer Financial Protection Bureau
    Federal Trade Commission
    State Attorney General - Consumer Protection Division
    [FCRA Attorney Name - if retained]
`;
}

// COMBO flow letter (combines accuracy, collection, and consent issues)
function generateComboLetter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraReferences: string[]
): string {
  const roundInfo = data.round ? ` (Round ${data.round})` : "";
  const fcraList = fcraReferences.map((ref) => `• ${ref}`).join("\n");

  // Categorize accounts by issue type
  const accuracyAccounts = data.accounts.filter(a =>
    a.issues?.some(i => ["BALANCE_INCONSISTENCY", "STATUS_INCONSISTENCY", "DATE_INCONSISTENCY", "LATE_PAYMENT_SEVERE", "LATE_PAYMENT_MODERATE"].includes(i.code))
  );
  const collectionAccounts = data.accounts.filter(a =>
    a.issues?.some(i => ["DEROGATORY_COLLECTION", "DEROGATORY_CHARGEOFF"].includes(i.code))
  );
  const otherAccounts = data.accounts.filter(a =>
    !accuracyAccounts.includes(a) && !collectionAccounts.includes(a)
  );

  return `${data.clientName}
${data.clientAddress}
${data.clientCity}, ${data.clientState} ${data.clientZip}

${data.currentDate}

${craInfo.name}
${craInfo.address}
${craInfo.city}, ${craInfo.state} ${craInfo.zip}

Re: Comprehensive Dispute - Multiple Issues Requiring Investigation${roundInfo}
SSN: XXX-XX-${data.clientSSN4}
DOB: ${data.clientDOB}

To Whom It May Concern:

I am writing to formally dispute multiple items on my credit report under the Fair Credit Reporting Act (FCRA) and, where applicable, the Fair Debt Collection Practices Act (FDCPA). This comprehensive dispute addresses accuracy issues, collection account validation requirements, and other FCRA violations.

════════════════════════════════════════════════════════════════════════════════
                         ALL DISPUTED ACCOUNTS
════════════════════════════════════════════════════════════════════════════════

${accountsList}
════════════════════════════════════════════════════════════════════════════════
                    SECTION 1: ACCURACY DISPUTES
════════════════════════════════════════════════════════════════════════════════
${accuracyAccounts.length > 0 ? `
The following accounts contain inaccurate information requiring investigation:

${accuracyAccounts.map(a => `• ${a.creditorName} - ${a.reason}`).join("\n")}

Under 15 U.S.C. § 1681e(b), you are required to follow reasonable procedures to assure maximum possible accuracy. The discrepancies noted above indicate a failure to meet this standard.
` : "No specific accuracy disputes in this filing."}

════════════════════════════════════════════════════════════════════════════════
                    SECTION 2: COLLECTION VALIDATION
════════════════════════════════════════════════════════════════════════════════
${collectionAccounts.length > 0 ? `
The following collection accounts require validation under the FDCPA:

${collectionAccounts.map(a => `• ${a.creditorName} - ${a.reason}`).join("\n")}

Under 15 U.S.C. § 1692g (FDCPA) and 15 U.S.C. § 1681s-2(b) (FCRA), these debts must be validated with:
1. Original signed contract or agreement
2. Complete payment history from original creditor
3. Documentation of chain of assignment/ownership
4. Proof debt is within statute of limitations
` : "No collection validation requests in this filing."}

════════════════════════════════════════════════════════════════════════════════
                    SECTION 3: ADDITIONAL ISSUES
════════════════════════════════════════════════════════════════════════════════
${otherAccounts.length > 0 ? `
The following additional items require investigation:

${otherAccounts.map(a => `• ${a.creditorName} - ${a.reason}`).join("\n")}
` : "No additional issues in this filing."}

════════════════════════════════════════════════════════════════════════════════
                         LEGAL BASIS
════════════════════════════════════════════════════════════════════════════════

${fcraList}
• 15 U.S.C. § 1692g - FDCPA Debt Validation Rights
• 15 U.S.C. § 1681i - Dispute Investigation Procedures

════════════════════════════════════════════════════════════════════════════════
                         REQUIRED ACTIONS
════════════════════════════════════════════════════════════════════════════════

Within 30 days (or 45 days if additional information is submitted), you must:

1. Conduct a reasonable investigation of ALL disputed items
2. Contact each furnisher and forward all relevant information
3. Require validation documentation for all collection accounts
4. Delete or correct any information that cannot be verified
5. Provide written results of your investigation
6. Send updated credit report if changes are made

Failure to properly investigate may result in liability under 15 U.S.C. § 1681n and § 1681o.

Thank you for your prompt attention to this comprehensive dispute.

Sincerely,


_______________________________
${data.clientName}

Enclosures:
- Copy of government-issued ID
- Proof of current address
- Supporting documentation (as applicable)

cc: Consumer Financial Protection Bureau
`;
}

function generateAccuracyLetter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraReferences: string[]
): string {
  const roundInfo = data.round ? ` (Round ${data.round})` : "";
  const fcraList = fcraReferences.map((ref) => `• ${ref}`).join("\n");

  return `${data.clientName}
${data.clientAddress}
${data.clientCity}, ${data.clientState} ${data.clientZip}

${data.currentDate}

${craInfo.name}
${craInfo.address}
${craInfo.city}, ${craInfo.state} ${craInfo.zip}

Re: Formal Dispute of Inaccurate Information - Request for Investigation${roundInfo}
SSN: XXX-XX-${data.clientSSN4}
DOB: ${data.clientDOB}

To Whom It May Concern:

I am writing to formally dispute inaccurate information appearing on my credit report. Under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681i, I am exercising my legal right to dispute the accuracy of the following accounts. This dispute requires your immediate attention and investigation.

════════════════════════════════════════════════════════════════════════════════
                              DISPUTED ACCOUNTS
════════════════════════════════════════════════════════════════════════════════

${accountsList}
════════════════════════════════════════════════════════════════════════════════
                         LEGAL BASIS FOR THIS DISPUTE
════════════════════════════════════════════════════════════════════════════════

This dispute is based on the following provisions of the Fair Credit Reporting Act:

${fcraList}

Pursuant to 15 U.S.C. § 1681e(b), consumer reporting agencies are required to "follow reasonable procedures to assure maximum possible accuracy of the information" contained in consumer reports. The information I am disputing fails to meet this standard.

Additionally, under 15 U.S.C. § 1681i(a), upon receiving this dispute, you are legally required to:

1. Conduct a reasonable investigation within 30 days (or 45 days if I submit additional information)
2. Forward all relevant information I provide to the furnisher(s)
3. Provide me with written results of your investigation
4. Delete or modify any information found to be inaccurate, incomplete, or unverifiable
5. Notify me of the results within 5 business days of completion

════════════════════════════════════════════════════════════════════════════════
                              REQUEST FOR ACTION
════════════════════════════════════════════════════════════════════════════════

I hereby request that you:

1. Investigate each disputed item listed above with the furnisher(s)
2. Verify the accuracy, completeness, and verifiability of all disputed information
3. Remove or correct any information that cannot be properly verified
4. Provide me with written notification of the results of your investigation
5. Provide me with a free copy of my updated credit report if any changes are made
6. Provide me with the name, address, and telephone number of each furnisher contacted

IMPORTANT NOTICE: Under 15 U.S.C. § 1681i(a)(5)(A), if you do not complete your investigation within the required timeframe, you must delete all disputed information from my credit file.

I have enclosed copies of my government-issued identification and proof of address as required. Please conduct a thorough investigation and respond within the timeframe required by law.

Thank you for your prompt attention to this matter.

Sincerely,


_______________________________
${data.clientName}

Enclosures:
- Copy of government-issued ID
- Proof of current address
- Supporting evidence documentation (if applicable)

cc: Consumer Financial Protection Bureau
`;
}

function generateCollectionLetter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraReferences: string[]
): string {
  const roundInfo = data.round ? ` (Round ${data.round})` : "";
  const fcraList = fcraReferences.map((ref) => `• ${ref}`).join("\n");

  return `${data.clientName}
${data.clientAddress}
${data.clientCity}, ${data.clientState} ${data.clientZip}

${data.currentDate}

${craInfo.name}
${craInfo.address}
${craInfo.city}, ${craInfo.state} ${craInfo.zip}

Re: Formal Dispute of Collection Accounts - Request for Debt Validation${roundInfo}
SSN: XXX-XX-${data.clientSSN4}
DOB: ${data.clientDOB}

To Whom It May Concern:

I am writing to formally dispute collection accounts appearing on my credit report. I am exercising my rights under both the Fair Debt Collection Practices Act (FDCPA) and the Fair Credit Reporting Act (FCRA) to challenge the validity and accuracy of these alleged debts.

════════════════════════════════════════════════════════════════════════════════
                         DISPUTED COLLECTION ACCOUNTS
════════════════════════════════════════════════════════════════════════════════

${accountsList}
════════════════════════════════════════════════════════════════════════════════
                         LEGAL BASIS FOR THIS DISPUTE
════════════════════════════════════════════════════════════════════════════════

This dispute is based on the following federal laws:

FAIR DEBT COLLECTION PRACTICES ACT (FDCPA):
• 15 U.S.C. § 1692g - Validation of debts

FAIR CREDIT REPORTING ACT (FCRA):
${fcraList}

Under 15 U.S.C. § 1692g (FDCPA), the collection agency must provide verification including:
1. The exact amount of the alleged debt
2. The name of the original creditor to whom the debt is owed
3. Written verification that the amount claimed is correct
4. A copy of any judgment, if applicable
5. Documentation showing the chain of ownership/assignment of the debt
6. Proof that the debt is within the statute of limitations

Under 15 U.S.C. § 1681s-2(b) (FCRA), upon notice of a dispute, the furnisher must:
1. Conduct a thorough investigation with respect to the disputed information
2. Review all relevant information provided by the consumer reporting agency
3. Report the results of the investigation to the consumer reporting agency
4. Modify, delete, or permanently block reporting of information found to be inaccurate

════════════════════════════════════════════════════════════════════════════════
                              REQUEST FOR ACTION
════════════════════════════════════════════════════════════════════════════════

I hereby request that you:

1. Demand that the collection agency provide complete validation of each debt
2. Investigate the accuracy, ownership, and validity of these accounts
3. Verify the collection agency's license to collect in my state of residence
4. Confirm the debt is within the applicable statute of limitations
5. Remove any collection accounts that cannot be fully validated with documentation
6. Provide me with written documentation of your investigation findings

IMPORTANT: Under 15 U.S.C. § 1692g(b), if validation is not provided, the collection agency must cease collection activities. Until these debts are properly validated with complete documentation, they should not appear on my credit report.

I have enclosed copies of my government-issued identification and proof of address as required.

Sincerely,


_______________________________
${data.clientName}

Enclosures:
- Copy of government-issued ID
- Proof of current address
- Supporting documentation (if applicable)

cc: Consumer Financial Protection Bureau
    State Attorney General's Office
`;
}

function generateConsentLetter(
  craInfo: typeof CRA_ADDRESSES.TRANSUNION,
  data: DisputeLetterData,
  accountsList: string,
  fcraReferences: string[]
): string {
  const roundInfo = data.round ? ` (Round ${data.round})` : "";
  const fcraList = fcraReferences.map((ref) => `• ${ref}`).join("\n");

  return `${data.clientName}
${data.clientAddress}
${data.clientCity}, ${data.clientState} ${data.clientZip}

${data.currentDate}

${craInfo.name}
${craInfo.address}
${craInfo.city}, ${craInfo.state} ${craInfo.zip}

Re: Formal Dispute - Unauthorized Access / Lack of Permissible Purpose${roundInfo}
SSN: XXX-XX-${data.clientSSN4}
DOB: ${data.clientDOB}

To Whom It May Concern:

I am writing to formally dispute accounts and/or inquiries appearing on my credit report for which I did not provide authorization or consent. These items were accessed or reported without my permission and without a permissible purpose as required by federal law.

════════════════════════════════════════════════════════════════════════════════
                      DISPUTED UNAUTHORIZED ITEMS
════════════════════════════════════════════════════════════════════════════════

${accountsList}
════════════════════════════════════════════════════════════════════════════════
                         LEGAL BASIS FOR THIS DISPUTE
════════════════════════════════════════════════════════════════════════════════

This dispute is based on the following provisions of the Fair Credit Reporting Act:

${fcraList}
• 15 U.S.C. § 1681b - Permissible Purposes of Consumer Reports
• 15 U.S.C. § 1681n - Civil Liability for Willful Noncompliance
• 15 U.S.C. § 1681o - Civil Liability for Negligent Noncompliance

Under 15 U.S.C. § 1681b (FCRA), a consumer report may ONLY be furnished for a "permissible purpose," which includes:
1. Written instructions of the consumer
2. In connection with a credit transaction initiated by the consumer
3. Employment purposes (ONLY with prior written consumer consent)
4. Legitimate business need in connection with a transaction initiated by the consumer
5. Review of an existing account

I DID NOT:
• Apply for credit with the entities listed above
• Provide written authorization for my credit to be accessed
• Initiate any transaction requiring a credit check
• Consent to employment screening by these parties

════════════════════════════════════════════════════════════════════════════════
                              REQUEST FOR ACTION
════════════════════════════════════════════════════════════════════════════════

I hereby request that you:

1. Investigate the permissible purpose for each disputed item
2. Require the entity to provide documented proof of my written authorization
3. Verify the specific permissible purpose claimed under 15 U.S.C. § 1681b
4. Remove ALL items for which no valid permissible purpose can be demonstrated
5. Provide me with the complete name, address, and telephone number of each entity that accessed my report
6. Preserve all records related to this unauthorized access for potential litigation

WARNING REGARDING LIABILITY: Under 15 U.S.C. § 1681n and § 1681o, willful or negligent violations of the FCRA may result in:
• Actual damages suffered by the consumer
• Statutory damages of $100 to $1,000 per violation
• Punitive damages for willful violations
• Attorney's fees and court costs

I demand the immediate removal of these unauthorized items from my credit file. Failure to properly investigate and remove these items may result in further legal action.

Sincerely,


_______________________________
${data.clientName}

Enclosures:
- Copy of government-issued ID
- Proof of current address

cc: Consumer Financial Protection Bureau
    Federal Trade Commission
`;
}

export function getDisputeReasonFromIssueCode(code: string): string {
  const reasons: Record<string, string> = {
    DEROGATORY_CHARGEOFF: "Account shows charge-off status that may be inaccurate or outdated",
    DEROGATORY_COLLECTION: "Collection account requires validation and verification",
    LATE_PAYMENT_SEVERE: "Late payment history is disputed - request verification",
    LATE_PAYMENT_MODERATE: "Payment history contains errors - request correction",
    PAST_DUE_AMOUNT: "Past due amount reported is inaccurate",
    BALANCE_INCONSISTENCY: "Account balance differs across credit bureaus",
    STATUS_INCONSISTENCY: "Account status differs across credit bureaus",
    DATE_INCONSISTENCY: "Account dates differ across credit bureaus",
    OUTDATED_ACCOUNT: "Account exceeds 7-year reporting period under FCRA",
    MISSING_REQUIRED_FIELDS: "Account is missing required reporting fields",
    STUDENT_LOAN_STATUS: "Student loan status may be incorrectly reported",
    MEDICAL_DEBT_RESTRICTION: "Medical debt reporting may violate FCRA restrictions",
  };
  return reasons[code] || "Information is inaccurate and requires verification";
}
