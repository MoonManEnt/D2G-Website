/**
 * Legal Citation Validator
 *
 * Validates legal citations in dispute letters, identifies invalid or
 * misapplied statutes, and provides auto-fix suggestions.
 */

import type {
  ValidCitation,
  InvalidCitation,
  CitationValidationResult,
  CitationFinding,
  CaseLaw,
} from "./types";

// =============================================================================
// VALID CITATIONS DATABASE (~30 entries)
// =============================================================================

export const VALID_CITATIONS: ValidCitation[] = [
  {
    statute: "15 USC 1681e(b)",
    shortName: "Maximum Possible Accuracy",
    fullText: "Every consumer reporting agency shall follow reasonable procedures to assure maximum possible accuracy of the information concerning the individual about whom the report relates.",
    applicableTo: ["CRA"],
    useFor: ["accuracy_disputes", "general_inaccuracy", "mixed_file", "outdated_info"],
    neverUseFor: ["debt_validation", "collector_disputes"],
    caseSupport: [
      { name: "Cushman v. TransUnion", citation: "115 F.3d 220 (3d Cir. 1997)", relevance: "CRA must follow reasonable procedures to assure maximum possible accuracy" },
    ],
  },
  {
    statute: "15 USC 1681i(a)(1)(A)",
    shortName: "Reinvestigation Duty",
    fullText: "If the completeness or accuracy of any item of information contained in a consumer's file is disputed, the agency shall conduct a reasonable reinvestigation to determine whether the disputed information is inaccurate.",
    applicableTo: ["CRA"],
    useFor: ["reinvestigation_request", "disputed_item", "failed_investigation"],
    neverUseFor: ["collector_disputes", "furnisher_only"],
    caseSupport: [
      { name: "Stevenson v. TRW Inc.", citation: "987 F.2d 288 (5th Cir. 1993)", relevance: "CRA cannot merely parrot furnisher information" },
    ],
  },
  {
    statute: "15 USC 1681i(a)(5)",
    shortName: "Reinvestigation Results",
    fullText: "The agency shall provide written notice of results of reinvestigation to the consumer within 5 business days after completion.",
    applicableTo: ["CRA"],
    useFor: ["results_request", "follow_up", "no_response"],
    neverUseFor: ["initial_dispute"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681i(a)(6)(B)(iii)",
    shortName: "Method of Verification",
    fullText: "The agency shall provide the consumer with a description of the procedure used to determine the accuracy and completeness of the information, including the name, address, and telephone number of any furnisher of information contacted.",
    applicableTo: ["CRA"],
    useFor: ["verification_request", "method_of_verification", "transparency"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681i(a)(7)",
    shortName: "Description of Reinvestigation Process",
    fullText: "The agency shall provide the consumer a description of the reinvestigation procedure used.",
    applicableTo: ["CRA"],
    useFor: ["process_transparency", "escalation"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681i(c)",
    shortName: "Information Provider Notice",
    fullText: "CRA must promptly notify information provider of dispute.",
    applicableTo: ["CRA"],
    useFor: ["furnisher_notification", "duty_to_notify"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681s-2(b)",
    shortName: "Furnisher Investigation Duties",
    fullText: "After receiving notice of a dispute from a CRA, the furnisher shall conduct an investigation with respect to the disputed information.",
    applicableTo: ["FURNISHER"],
    useFor: ["furnisher_dispute", "investigation_duty", "direct_dispute"],
    neverUseFor: ["collector_disputes", "cra_only"],
    caseSupport: [
      { name: "Gorman v. Wolpoff & Abramson", citation: "584 F.3d 1147 (9th Cir. 2009)", relevance: "Furnishers must conduct reasonable investigation" },
    ],
  },
  {
    statute: "15 USC 1681s-2(a)",
    shortName: "Duty of Furnishers to Provide Accurate Information",
    fullText: "A person shall not furnish any information relating to a consumer to any CRA if the person knows or has reasonable cause to believe that the information is inaccurate.",
    applicableTo: ["FURNISHER"],
    useFor: ["known_inaccuracy", "willful_noncompliance"],
    neverUseFor: ["cra_only"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681c(a)",
    shortName: "Obsolete Information / 7-Year Rule",
    fullText: "No CRA may make any consumer report containing information on accounts placed for collection or charged off which antedate the report by more than 7 years.",
    applicableTo: ["CRA"],
    useFor: ["obsolete_information", "7_year_rule", "expired_reporting"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681c(e)",
    shortName: "Information Update",
    fullText: "CRA must promptly update or delete information found to be inaccurate, incomplete, or unverifiable.",
    applicableTo: ["CRA"],
    useFor: ["deletion_request", "update_request", "unverifiable_info"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681n",
    shortName: "Civil Liability - Willful Noncompliance",
    fullText: "Any person who willfully fails to comply with any requirement of this title with respect to any consumer is liable to that consumer.",
    applicableTo: ["CRA", "FURNISHER", "COLLECTOR"],
    useFor: ["damages_claim", "willful_violation", "litigation_threat"],
    neverUseFor: ["initial_dispute"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681o",
    shortName: "Civil Liability - Negligent Noncompliance",
    fullText: "Any person who is negligent in failing to comply with any requirement of this title is liable to the consumer.",
    applicableTo: ["CRA", "FURNISHER", "COLLECTOR"],
    useFor: ["damages_claim", "negligent_violation"],
    neverUseFor: ["initial_dispute"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681(b)",
    shortName: "Permissible Purposes",
    fullText: "Information may only be furnished for permissible purposes outlined in this section.",
    applicableTo: ["CRA"],
    useFor: ["permissible_purpose_challenge", "unauthorized_access"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681b(a)(3)(A)",
    shortName: "Credit Transaction Purpose",
    fullText: "A CRA may furnish a report in connection with a credit transaction involving the consumer.",
    applicableTo: ["CRA"],
    useFor: ["permissible_purpose_detail"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1692g",
    shortName: "Debt Validation",
    fullText: "Within five days of initial communication, debt collector must send validation notice with amount of debt, name of creditor, and consumer's rights.",
    applicableTo: ["COLLECTOR"],
    useFor: ["debt_validation", "initial_collection_dispute", "validation_request"],
    neverUseFor: ["cra_disputes"],
    commonMisuse: "Often incorrectly cited in disputes to CRAs. Only applies to debt collectors, not CRAs.",
    caseSupport: [],
  },
  {
    statute: "15 USC 1692g(b)",
    shortName: "Cease Collection Until Validated",
    fullText: "If the consumer disputes the debt, the collector shall cease collection until it provides verification.",
    applicableTo: ["COLLECTOR"],
    useFor: ["cease_collection", "validation_pending"],
    neverUseFor: ["cra_disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1692e",
    shortName: "False or Misleading Representations",
    fullText: "A debt collector may not use any false, deceptive, or misleading representation in connection with the collection of any debt.",
    applicableTo: ["COLLECTOR"],
    useFor: ["deceptive_practices", "false_amount", "misrepresentation"],
    neverUseFor: ["cra_disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1692e(10)",
    shortName: "Deceptive Means to Collect",
    fullText: "Prohibition on use of any false representation or deceptive means to collect or attempt to collect any debt.",
    applicableTo: ["COLLECTOR"],
    useFor: ["deceptive_collection", "false_threats"],
    neverUseFor: ["cra_disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1692c(c)",
    shortName: "Cease Communication",
    fullText: "If a consumer notifies a debt collector in writing that the consumer refuses to pay, the collector shall cease communication.",
    applicableTo: ["COLLECTOR"],
    useFor: ["cease_communication", "stop_contact"],
    neverUseFor: ["cra_disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681c-2",
    shortName: "Block of Information from Identity Theft",
    fullText: "A CRA shall block the reporting of any information identified as having resulted from an alleged identity theft.",
    applicableTo: ["CRA"],
    useFor: ["identity_theft_block", "fraud_block"],
    neverUseFor: ["non_fraud_disputes"],
    caseSupport: [],
  },
  {
    statute: "12 CFR 1022.43",
    shortName: "Direct Disputes with Furnishers",
    fullText: "A furnisher must conduct a reasonable investigation of a direct dispute.",
    applicableTo: ["FURNISHER"],
    useFor: ["direct_furnisher_dispute", "bypass_cra"],
    neverUseFor: ["cra_disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681j",
    shortName: "Free Annual Report",
    fullText: "Every consumer is entitled to a free copy of their credit report annually.",
    applicableTo: ["CRA"],
    useFor: ["report_request", "consumer_rights"],
    neverUseFor: ["dispute_letters"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681g",
    shortName: "Disclosure of Information",
    fullText: "CRA shall clearly and accurately disclose all information in the consumer's file at the time of the request.",
    applicableTo: ["CRA"],
    useFor: ["file_disclosure", "information_request"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681s-2(a)(1)(A)",
    shortName: "Prohibition on Reporting Known Inaccuracies",
    fullText: "A person shall not furnish information relating to a consumer that the person knows or has reasonable cause to believe is inaccurate.",
    applicableTo: ["FURNISHER"],
    useFor: ["known_inaccuracy", "furnisher_liability"],
    neverUseFor: ["cra_disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681s-2(a)(8)",
    shortName: "Duty to Provide Accurate DOFD",
    fullText: "A furnisher must provide the accurate date of first delinquency.",
    applicableTo: ["FURNISHER"],
    useFor: ["dofd_dispute", "date_accuracy"],
    neverUseFor: ["cra_disputes"],
    caseSupport: [],
  },
];

// =============================================================================
// INVALID / MISAPPLIED CITATIONS DATABASE (~10 entries)
// =============================================================================

export const INVALID_CITATIONS: InvalidCitation[] = [
  {
    statute: "15 USC 1681a(d)(2)",
    commonClaim: "Accounts are excluded information under the definition of consumer report",
    whyItFails: "This defines what is NOT a consumer report (raw transaction data for internal use). It does NOT prohibit reporting credit accounts to CRAs. This is a definitional section, not a consumer right.",
    correctApproach: "Use 15 USC 1681e(b) for accuracy challenges or 15 USC 1681i(a)(1)(A) for reinvestigation requests.",
    correctStatute: "15 USC 1681e(b)",
  },
  {
    statute: "15 USC 1681b(a)(2)",
    commonClaim: "No written consent means no permissible purpose — all reporting without written consent is illegal",
    whyItFails: "Written consent (section b(a)(2)) is only ONE of several permissible purposes. Credit reporting typically uses 1681b(a)(3)(A) — credit transaction purpose — which does NOT require written consent.",
    correctApproach: "Only cite 1681b(a)(2) in genuine consent/fraud disputes where NO legitimate purpose exists. For routine disputes, use 1681e(b) or 1681i(a)(1)(A).",
    correctStatute: "15 USC 1681e(b)",
  },
  {
    statute: "15 USC 1681q",
    commonClaim: "Criminal penalties apply and you will face prosecution",
    whyItFails: "Section 1681q covers criminal penalties for obtaining a credit report under false pretenses. Criminal statutes are enforced by government prosecutors, NOT private citizens. Consumers cannot prosecute under this section and threatening prosecution undermines credibility.",
    correctApproach: "Use 15 USC 1681n for willful noncompliance civil liability or 15 USC 1681o for negligent noncompliance.",
    correctStatute: "15 USC 1681n",
  },
  {
    statute: "15 USC 1692j",
    commonClaim: "Collection agency used unfair or deceptive forms",
    whyItFails: "Section 1692j prohibits furnishing deceptive collection forms designed to create the false belief that a third party is involved. It does NOT apply to standard credit reporting of collection accounts.",
    correctApproach: "For collection disputes, use 15 USC 1692g for validation or 15 USC 1692e for false representations. For CRA disputes about collections, use 15 USC 1681e(b).",
    correctStatute: "15 USC 1692g",
  },
  {
    statute: "15 USC 1681a(m)",
    commonClaim: "Account is a transaction and not reportable",
    whyItFails: "Section 1681a(m) defines 'medical information' restrictions. It does NOT define all transactions as non-reportable. Credit accounts are explicitly reportable under the FCRA.",
    correctApproach: "Use 1681e(b) for accuracy challenges.",
    correctStatute: "15 USC 1681e(b)",
  },
  {
    statute: "15 USC 1681a(d)(2)(A)(i)",
    commonClaim: "Reports between affiliates are excluded and therefore my account cannot be reported",
    whyItFails: "This exclusion applies to communications between corporate affiliates for internal use only. It does NOT prevent a furnisher from reporting your account to a CRA.",
    correctApproach: "Focus on accuracy under 1681e(b) rather than attempting to argue the account is non-reportable.",
    correctStatute: "15 USC 1681e(b)",
  },
  {
    statute: "15 USC 1681a(d)(2)(B)",
    commonClaim: "Consumer report definition excludes this account",
    whyItFails: "This exclusion covers communications made in connection with employment background checks that are disclosed to the consumer. It does not exclude standard credit account reporting.",
    correctApproach: "Use 15 USC 1681e(b) for accuracy or 15 USC 1681i for reinvestigation.",
    correctStatute: "15 USC 1681e(b)",
  },
  {
    statute: "Hodge v. Texaco",
    commonClaim: "Hodge v. Texaco supports credit reporting violations",
    whyItFails: "Hodge v. Texaco Inc. is an employment discrimination case, NOT an FCRA case. Citing it in credit disputes shows the letter was generated from an unreliable template and damages credibility.",
    correctApproach: "Use Cushman v. TransUnion for accuracy disputes or Stevenson v. TRW for reinvestigation duty.",
  },
  {
    statute: "15 USC 1681(a)(4)",
    commonClaim: "Right to privacy prevents reporting",
    whyItFails: "Section 1681(a)(4) is a Congressional finding about balancing privacy rights with legitimate business needs. It is a statement of purpose, NOT an enforceable consumer right that can be cited in disputes.",
    correctApproach: "Use specific enforceable sections like 1681e(b), 1681i, or 1681s-2(b).",
    correctStatute: "15 USC 1681e(b)",
  },
];

// =============================================================================
// CITATION EXTRACTION
// =============================================================================

const STATUTE_PATTERN = /(?:15\s*U\.?S\.?C\.?\s*(?:§\s*)?|15\s*USC\s*)(\d{4}[a-z]?(?:\([a-z0-9]+\))*(?:-\d+)?(?:\([a-z0-9]+\))*)/gi;
const CASE_PATTERN = /(?:Hodge\s+v\.\s+Texaco|Cushman\s+v\.\s+TransUnion|Stevenson\s+v\.\s+TRW|Gorman\s+v\.\s+Wolpoff)/gi;
const CFR_PATTERN = /12\s*CFR\s*(?:§\s*)?(\d+\.\d+)/gi;

function extractStatuteCitations(content: string): Array<{ statute: string; location: number; lineNumber: number }> {
  const citations: Array<{ statute: string; location: number; lineNumber: number }> = [];
  const lines = content.split("\n");

  let charOffset = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Extract USC statutes
    let match: RegExpExecArray | null;
    const statuteRegex = new RegExp(STATUTE_PATTERN.source, "gi");
    while ((match = statuteRegex.exec(line)) !== null) {
      const normalized = `15 USC ${match[1]}`.replace(/\s+/g, " ");
      citations.push({
        statute: normalized,
        location: charOffset + match.index,
        lineNumber: lineIdx + 1,
      });
    }

    // Extract case citations
    const caseRegex = new RegExp(CASE_PATTERN.source, "gi");
    while ((match = caseRegex.exec(line)) !== null) {
      citations.push({
        statute: match[0],
        location: charOffset + match.index,
        lineNumber: lineIdx + 1,
      });
    }

    charOffset += line.length + 1;
  }

  return citations;
}

// =============================================================================
// VALIDATION ENGINE
// =============================================================================

/**
 * Validate all legal citations in a dispute letter.
 */
export function validateLetterCitations(
  content: string,
  targetType: "CRA" | "FURNISHER" | "COLLECTOR"
): CitationValidationResult {
  const extracted = extractStatuteCitations(content);
  const errors: CitationFinding[] = [];
  const warnings: CitationFinding[] = [];
  const validCitationsUsed: string[] = [];

  for (const citation of extracted) {
    // Normalize for comparison
    const normalized = citation.statute.replace(/\s+/g, " ").trim();

    // Check against invalid citations
    const invalidMatch = INVALID_CITATIONS.find((ic) => {
      const icNorm = ic.statute.replace(/\s+/g, " ").trim();
      return normalized.includes(icNorm) || icNorm.includes(normalized) ||
        normalized.toLowerCase() === icNorm.toLowerCase();
    });

    if (invalidMatch) {
      errors.push({
        statute: citation.statute,
        location: citation.location,
        lineNumber: citation.lineNumber,
        severity: "ERROR",
        message: `Invalid citation: ${invalidMatch.whyItFails}`,
        suggestedFix: invalidMatch.correctStatute
          ? `Replace with ${invalidMatch.correctStatute}: ${invalidMatch.correctApproach}`
          : invalidMatch.correctApproach,
      });
      continue;
    }

    // Check against valid citations for target type mismatch
    const validMatch = VALID_CITATIONS.find((vc) => {
      const vcNorm = vc.statute.replace(/\s+/g, " ").trim();
      return normalized.includes(vcNorm) || vcNorm.includes(normalized);
    });

    if (validMatch) {
      if (!validMatch.applicableTo.includes(targetType)) {
        warnings.push({
          statute: citation.statute,
          location: citation.location,
          lineNumber: citation.lineNumber,
          severity: "WARNING",
          message: `${validMatch.shortName} applies to ${validMatch.applicableTo.join("/")} disputes, not ${targetType}. ${validMatch.commonMisuse || ""}`,
          suggestedFix: `Consider removing this citation or replacing with a statute applicable to ${targetType} disputes.`,
        });
      } else {
        validCitationsUsed.push(citation.statute);
      }
    }
    // If not found in either database, treat as potentially valid (unknown)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validCitationsUsed: [...new Set(validCitationsUsed)],
    totalCitations: extracted.length,
  };
}

// =============================================================================
// AUTO-FIX ENGINE
// =============================================================================

/**
 * Auto-fix invalid citations in letter content by replacing with correct alternatives.
 */
export function autoFixCitations(
  content: string,
  result: CitationValidationResult
): string {
  let fixed = content;

  // Process errors that have suggested fixes with specific statutes
  for (const error of result.errors) {
    const invalidMatch = INVALID_CITATIONS.find((ic) => {
      const icNorm = ic.statute.replace(/\s+/g, " ").trim();
      const errNorm = error.statute.replace(/\s+/g, " ").trim();
      return errNorm.includes(icNorm) || icNorm.includes(errNorm) ||
        errNorm.toLowerCase() === icNorm.toLowerCase();
    });

    if (invalidMatch?.correctStatute) {
      // Find the valid citation data for the replacement
      const replacement = VALID_CITATIONS.find((vc) =>
        vc.statute === invalidMatch.correctStatute
      );

      if (replacement) {
        // Replace the invalid statute reference with the correct one
        // Match various formatting patterns
        const patterns = [
          new RegExp(`15\\s*U\\.?S\\.?C\\.?\\s*(?:§\\s*)?${escapeRegex(invalidMatch.statute.replace("15 USC ", ""))}`, "gi"),
          new RegExp(escapeRegex(invalidMatch.statute), "gi"),
        ];

        for (const pattern of patterns) {
          fixed = fixed.replace(pattern, `15 U.S.C. § ${replacement.statute.replace("15 USC ", "")}`);
        }
      }
    }
  }

  return fixed;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
