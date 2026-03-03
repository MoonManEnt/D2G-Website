/**
 * Litigation Document Templates
 *
 * Provides structural templates for AI-generated legal documents.
 * The AI generates prose within these structures. Each template defines
 * sections with guidance that instruct the LLM what to produce.
 */

import type {
  DocumentTemplate,
  DocumentSection,
  LitigationDocumentType,
  DocumentGenerationContext,
} from "./types";

// ============================================================================
// AI Disclaimer
// ============================================================================

export const AI_DISCLAIMER =
  "IMPORTANT NOTICE: This document was drafted with AI assistance as a starting point. It does not constitute legal advice. Review by a licensed attorney is strongly recommended before filing or sending this document.";

// ============================================================================
// Section Helpers
// ============================================================================

function section(
  id: string,
  label: string,
  required: boolean,
  description: string,
  promptGuidance: string
): DocumentSection {
  return { id, label, required, description, promptGuidance };
}

// ============================================================================
// Document Templates
// ============================================================================

export const DOCUMENT_TEMPLATES: Record<LitigationDocumentType, DocumentTemplate> = {
  // --------------------------------------------------------------------------
  // DEMAND_LETTER
  // --------------------------------------------------------------------------
  DEMAND_LETTER: {
    documentType: "DEMAND_LETTER",
    title: "Demand Letter",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "header",
        "Header",
        true,
        "Date, from address, to address",
        "Include the current date, the consumer's full name and mailing address as the sender, and the defendant's name and mailing address as the recipient. Use standard business letter format."
      ),
      section(
        "re_line",
        "RE Line",
        true,
        "RE: reference line with case/account info",
        "Write a concise RE: line referencing the case or account number, the consumer's name, and a brief descriptor (e.g., 'RE: Violations of Fair Credit Reporting Act — Account #XXXX')."
      ),
      section(
        "violation_summary",
        "Violation Summary",
        true,
        "List of violations with statute citations",
        "Enumerate each identified violation. For each, cite the specific statute (e.g., 15 U.S.C. § 1681e(b), 15 U.S.C. § 1692e), describe the factual basis, and explain how the defendant's conduct violates the statute. Use numbered paragraphs."
      ),
      section(
        "damage_calculation",
        "Damage Calculation",
        true,
        "Statutory + actual + punitive damages breakdown with amounts",
        "Provide a detailed damages breakdown: statutory damages per violation (citing the statute authorizing them), actual damages sustained by the consumer, and any basis for punitive damages. Include specific dollar amounts or ranges where possible. Show the total aggregate damages."
      ),
      section(
        "settlement_demand",
        "Settlement Demand",
        true,
        "Specific dollar amount demanded, rationale",
        "State the specific dollar amount demanded for settlement. Explain the rationale for the amount, referencing the damages calculation. Indicate willingness to negotiate in good faith while making clear the strength of the claims."
      ),
      section(
        "deadline",
        "Response Deadline",
        true,
        "30-day response deadline with consequences",
        "State a 30-day deadline from the date of the letter for the defendant to respond. Clearly describe the consequences of failing to respond, including the consumer's intent to pursue formal legal action, file regulatory complaints, and seek all available statutory and actual damages."
      ),
      section(
        "closing",
        "Closing",
        true,
        "Professional closing with signature block",
        "Close with a professional tone (e.g., 'Sincerely' or 'Respectfully'). Include a signature block with the consumer's printed name and any relevant contact information. Note that the consumer reserves all rights and remedies."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // CFPB_COMPLAINT
  // --------------------------------------------------------------------------
  CFPB_COMPLAINT: {
    documentType: "CFPB_COMPLAINT",
    title: "CFPB Complaint",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "product",
        "Financial Product/Service",
        true,
        "Financial product/service type",
        "Identify the specific financial product or service involved (e.g., 'Credit reporting', 'Debt collection', 'Credit card', 'Mortgage'). Use CFPB's standard product categories."
      ),
      section(
        "issue",
        "Issue",
        true,
        "Primary issue description",
        "Describe the primary issue using CFPB's standard issue categories (e.g., 'Incorrect information on your report', 'Improper use of your report', 'Problem with a credit reporting company's investigation'). Be specific and concise."
      ),
      section(
        "company",
        "Company",
        true,
        "Company being complained about",
        "Provide the full legal name of the company being complained about, along with any known subsidiary or trade names. Include the company's address if available."
      ),
      section(
        "narrative",
        "Narrative",
        true,
        "Detailed chronological narrative (plain language, NO legal citations)",
        "Write a detailed chronological narrative of what happened in plain, everyday language. Do NOT include legal citations or statutory references — the CFPB prefers consumer-friendly language. Include dates, names, account numbers (partially redacted), and specific actions taken by the consumer and the company. Describe all attempts to resolve the issue directly with the company."
      ),
      section(
        "desired_resolution",
        "Desired Resolution",
        true,
        "What the consumer wants",
        "State clearly what the consumer wants as a resolution (e.g., correction of credit report, cessation of collection activity, monetary refund, written apology). Be specific and realistic."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // AG_COMPLAINT
  // --------------------------------------------------------------------------
  AG_COMPLAINT: {
    documentType: "AG_COMPLAINT",
    title: "State Attorney General Complaint",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "header",
        "Header",
        true,
        "State AG office address, date",
        "Address the complaint to the appropriate State Attorney General's Consumer Protection Division. Include the AG office's full mailing address and the current date. Use formal letter format."
      ),
      section(
        "consumer_info",
        "Consumer Information",
        true,
        "Consumer's name, address, contact",
        "Provide the consumer's full legal name, mailing address, phone number, and email address. This is required by most AG offices for follow-up."
      ),
      section(
        "company_info",
        "Company Information",
        true,
        "Company name, address, account numbers",
        "Provide the company's full legal name, mailing address, phone number (if known), website, and any relevant account or reference numbers associated with the consumer's dealings."
      ),
      section(
        "complaint_description",
        "Complaint Description",
        true,
        "Detailed description of violations",
        "Describe the company's conduct in detail, including specific dates, communications, and actions. Reference applicable state consumer protection statutes and federal laws (FCRA, FDCPA) where relevant. Explain how the company's conduct harms consumers and potentially violates state and federal law."
      ),
      section(
        "relief_sought",
        "Relief Sought",
        true,
        "Requested remedy",
        "State the specific remedies requested: investigation of the company's practices, enforcement action, restitution for the consumer, correction of credit reports, and any other appropriate relief. Request that the AG's office contact the consumer with the outcome."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // FTC_COMPLAINT
  // --------------------------------------------------------------------------
  FTC_COMPLAINT: {
    documentType: "FTC_COMPLAINT",
    title: "FTC Complaint",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "consumer_info",
        "Consumer Information",
        true,
        "Consumer's identifying info",
        "Provide the consumer's full name, mailing address, phone number, and email address. Include any relevant account identifiers."
      ),
      section(
        "company_info",
        "Company Information",
        true,
        "Company details",
        "Provide the company's full name, mailing address, phone number, website URL, and any known parent company or affiliate information."
      ),
      section(
        "issue_description",
        "Issue Description",
        true,
        "What happened, when, how",
        "Describe in detail what happened, including specific dates, amounts, and communications. Explain how the company's practices are unfair or deceptive. Include any evidence of a pattern of behavior. Reference applicable FTC Act provisions and related federal statutes."
      ),
      section(
        "impact",
        "Impact",
        true,
        "Financial/emotional impact on consumer",
        "Describe the financial impact (dollar amounts lost, fees incurred, credit damage) and the emotional/practical impact on the consumer (stress, denied credit, inability to obtain housing or employment). Quantify damages where possible."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // INTENT_TO_SUE
  // --------------------------------------------------------------------------
  INTENT_TO_SUE: {
    documentType: "INTENT_TO_SUE",
    title: "Intent to Sue Notice",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "caption",
        "Caption",
        true,
        'Legal heading / "NOTICE OF INTENT TO FILE SUIT"',
        'Begin with a formal legal heading: "NOTICE OF INTENT TO FILE SUIT." Include the consumer\'s name and address, the defendant\'s name and address, and the date. Use bold formatting for the notice title.'
      ),
      section(
        "violation_summary",
        "Violation Summary",
        true,
        "Specific statutes violated with descriptions",
        "List each statute violated with its full citation (e.g., 15 U.S.C. § 1681e(b) — Duty to Assure Maximum Possible Accuracy). For each violation, provide a concise factual description of the defendant's violating conduct."
      ),
      section(
        "statutory_authority",
        "Statutory Authority",
        true,
        "Legal basis (15 USC 1681n, 1681o, etc.)",
        "Cite the specific statutory provisions authorizing the consumer's private right of action (e.g., 15 U.S.C. § 1681n for willful noncompliance, 15 U.S.C. § 1681o for negligent noncompliance, 15 U.S.C. § 1692k for FDCPA violations). Explain the remedies available under each provision."
      ),
      section(
        "damage_demand",
        "Damage Demand",
        true,
        "Specific damages sought with calculation",
        "State the specific damages sought, broken down by category: statutory damages per violation, actual damages, punitive damages (if applicable), and attorney fees and costs. Provide a total figure and explain the calculation methodology."
      ),
      section(
        "filing_deadline",
        "Filing Deadline",
        true,
        "Date by which suit will be filed if not resolved (typically 15-30 days)",
        "State a specific date (typically 15 to 30 days from the notice date) by which the consumer will file suit if the matter is not resolved. Make clear this is a final opportunity to resolve the matter without litigation. State the court in which suit will be filed."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // SMALL_CLAIMS_COMPLAINT
  // --------------------------------------------------------------------------
  SMALL_CLAIMS_COMPLAINT: {
    documentType: "SMALL_CLAIMS_COMPLAINT",
    title: "Small Claims Court Complaint",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "caption",
        "Caption",
        true,
        "Court name, case caption (Plaintiff v. Defendant)",
        "Include the full name of the small claims court (with county and state), a placeholder for the case number, and the case caption in 'Plaintiff v. Defendant' format. Use proper court formatting conventions."
      ),
      section(
        "parties",
        "Parties",
        true,
        "Plaintiff and defendant identification with addresses",
        "Identify the Plaintiff (consumer) with full name and address, and the Defendant (company) with full legal name, registered agent (if known), and address. If there are multiple defendants, list each separately."
      ),
      section(
        "facts",
        "Statement of Facts",
        true,
        "Numbered factual allegations",
        "Present the factual allegations in numbered paragraphs. Each paragraph should contain one distinct fact. Start with background (credit accounts, relationship with defendant), then describe the violations chronologically. Include dates, communications, and specific actions or failures to act."
      ),
      section(
        "claims",
        "Legal Claims",
        true,
        "Legal claims with statute references",
        "State each legal claim (cause of action) with the applicable statute. For each claim, incorporate the relevant factual allegations by reference and explain how the facts establish a violation. Include FCRA claims (15 U.S.C. § 1681 et seq.) and/or FDCPA claims (15 U.S.C. § 1692 et seq.) as applicable."
      ),
      section(
        "amount_sought",
        "Amount Sought",
        true,
        "Dollar amount with breakdown",
        "State the total dollar amount sought, ensuring it falls within the small claims court's jurisdictional limit. Provide a breakdown: statutory damages, actual damages, court costs, and filing fees. Do not include attorney fees (small claims courts typically do not award them)."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // FEDERAL_COMPLAINT
  // --------------------------------------------------------------------------
  FEDERAL_COMPLAINT: {
    documentType: "FEDERAL_COMPLAINT",
    title: "Federal Court Complaint",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "caption",
        "Caption",
        true,
        "Court name, civil action number placeholder, case caption",
        "Include the full name of the United States District Court (district and division), a placeholder for the civil action number (e.g., 'Civil Action No. ____'), and the case caption with Plaintiff and Defendant designations. Follow Federal Rules of Civil Procedure formatting."
      ),
      section(
        "parties",
        "Parties",
        true,
        "Identification of all parties with addresses",
        "Identify all parties with full legal names, addresses, and their roles. For the Plaintiff, include state of residence. For corporate Defendants, include state of incorporation, principal place of business, and registered agent information where known."
      ),
      section(
        "jurisdiction_venue",
        "Jurisdiction and Venue",
        true,
        "Subject matter jurisdiction (28 USC 1331/1337), venue",
        "Establish subject matter jurisdiction under 28 U.S.C. § 1331 (federal question) and/or 28 U.S.C. § 1337 (commerce and antitrust regulations). Cite the specific federal statutes giving rise to the claims (FCRA, FDCPA). Establish venue under 28 U.S.C. § 1391(b). Explain why this district is proper."
      ),
      section(
        "factual_allegations",
        "Factual Allegations",
        true,
        "Numbered paragraphs of facts",
        "Present all factual allegations in consecutively numbered paragraphs. Begin with the parties and their relationship, then detail the credit reporting or debt collection activity, the consumer's disputes, and the defendant's responses or failures. Include specific dates, account numbers, correspondence, and outcomes. Each paragraph should contain one discrete factual allegation."
      ),
      section(
        "causes_of_action",
        "Causes of Action",
        true,
        "Each count (FCRA/FDCPA violations) as separate numbered section",
        "Present each cause of action as a separately numbered Count (e.g., 'COUNT I — Violation of 15 U.S.C. § 1681e(b)'). For each Count: reincorporate prior allegations by reference, state the statutory provision violated, explain how the defendant's conduct violates the statute, state whether the violation is willful or negligent, and identify the damages sought under that count."
      ),
      section(
        "prayer_for_relief",
        "Prayer for Relief",
        true,
        "Specific damages, injunctive relief, attorney fees, costs",
        "State the specific relief sought in a 'WHEREFORE' clause: actual damages, statutory damages under each applicable statute, punitive damages (for willful violations), declaratory and/or injunctive relief, reasonable attorney fees and costs under 15 U.S.C. § 1681n(a)(3) or § 1692k(a)(3), pre- and post-judgment interest, and any other relief the Court deems just and proper."
      ),
      section(
        "verification",
        "Verification",
        true,
        "Declaration under penalty of perjury, signature block",
        "Include a verification declaration: 'I declare under penalty of perjury under the laws of the United States of America that the foregoing is true and correct.' Provide a dated signature block with the Plaintiff's name, address, phone number, and email. If represented by counsel, include counsel's information and bar number."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // SUMMONS
  // --------------------------------------------------------------------------
  SUMMONS: {
    documentType: "SUMMONS",
    title: "Summons",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "caption",
        "Caption",
        true,
        "Court name, case caption",
        "Include the full court name, the case number (or placeholder), and the case caption in standard format. Title the document 'SUMMONS' prominently."
      ),
      section(
        "defendant_info",
        "Defendant Information",
        true,
        "Name and address of defendant",
        "Address the summons 'TO:' the defendant's full legal name and address. If serving a corporation, address it to the registered agent or officer authorized to accept service."
      ),
      section(
        "court_address",
        "Court Address",
        true,
        "Where to file response",
        "State the full address of the court where the defendant must file their response, including the clerk's office name, street address, city, state, and zip code."
      ),
      section(
        "response_deadline",
        "Response Deadline",
        true,
        "Days to respond (varies by jurisdiction)",
        "State the number of days the defendant has to file a written response after being served (typically 21 days in federal court under FRCP 12(a)(1), or as specified by state rules). Warn that failure to respond may result in a default judgment."
      ),
      section(
        "clerk_signature",
        "Clerk Signature",
        true,
        "Clerk of Court signature block placeholder",
        "Include a signature block for the Clerk of Court with a line for signature, the printed title 'Clerk of Court', the date of issuance, and the court seal placeholder. Add a line for the deputy clerk if applicable."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // INTERROGATORIES
  // --------------------------------------------------------------------------
  INTERROGATORIES: {
    documentType: "INTERROGATORIES",
    title: "Interrogatories",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "caption",
        "Caption",
        true,
        "Court name, case caption",
        "Include the full court name, case number (or placeholder), case caption, and title the document 'PLAINTIFF'S FIRST SET OF INTERROGATORIES TO DEFENDANT [Name]'."
      ),
      section(
        "definitions",
        "Definitions",
        true,
        "Key terms used in interrogatories",
        "Define key terms used throughout the interrogatories: 'You/Your' (referring to the defendant and its agents), 'Document' (broadly defined), 'Communication' (any form of information exchange), 'Consumer Report' (as defined in 15 U.S.C. § 1681a(d)), 'Identify' (provide name, address, title), and any other terms specific to the case."
      ),
      section(
        "instructions",
        "Instructions",
        true,
        "How to respond, obligations under FRCP 33",
        "State that these interrogatories are propounded pursuant to Federal Rule of Civil Procedure 33. Instruct the defendant to answer each interrogatory separately and fully in writing under oath within 30 days. Note the obligation to supplement responses under FRCP 26(e). State that objections must be stated with specificity."
      ),
      section(
        "questions",
        "Interrogatories",
        true,
        "Numbered interrogatories (up to 25 per FRCP 33)",
        "Draft up to 25 numbered interrogatories targeting: the defendant's investigation procedures, persons involved in handling the consumer's account/dispute, the factual basis for reporting decisions, communications with furnishers or other CRAs, policies and procedures for ensuring accuracy, training provided to employees, prior complaints of similar nature, and any corrective actions taken. Each interrogatory should be specific, non-compound, and directly relevant to the claims."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // REQUEST_FOR_PRODUCTION
  // --------------------------------------------------------------------------
  REQUEST_FOR_PRODUCTION: {
    documentType: "REQUEST_FOR_PRODUCTION",
    title: "Request for Production of Documents",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "caption",
        "Caption",
        true,
        "Court name, case caption",
        "Include the full court name, case number (or placeholder), case caption, and title the document 'PLAINTIFF'S FIRST REQUEST FOR PRODUCTION OF DOCUMENTS TO DEFENDANT [Name]'."
      ),
      section(
        "definitions",
        "Definitions",
        true,
        "Terms defined",
        "Define key terms: 'Document' (all tangible and electronically stored information, including emails, reports, memoranda, policies, screen captures, database records, and metadata), 'Communication', 'You/Your', and case-specific terms. Reference FRCP 34 standards for production format."
      ),
      section(
        "requests",
        "Document Requests",
        true,
        "Numbered document requests targeting credit reporting records, investigation files, policies, communications",
        "Draft numbered requests for production targeting: (1) all credit reporting records related to the consumer, (2) complete investigation files for each dispute, (3) all communications with furnishers regarding the consumer's accounts, (4) policies and procedures for dispute investigation and reinvestigation, (5) training materials for employees handling disputes, (6) quality control records, (7) all communications between the defendant and any third party regarding the consumer, (8) internal memoranda or notes regarding the consumer's account, (9) software system records and audit logs, and (10) any other documents relevant to the claims and defenses. Each request should be specific and proportional to the needs of the case under FRCP 26(b)(1)."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // REQUEST_FOR_ADMISSION
  // --------------------------------------------------------------------------
  REQUEST_FOR_ADMISSION: {
    documentType: "REQUEST_FOR_ADMISSION",
    title: "Request for Admission",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "caption",
        "Caption",
        true,
        "Court name, case caption",
        "Include the full court name, case number (or placeholder), case caption, and title the document 'PLAINTIFF'S FIRST REQUEST FOR ADMISSIONS TO DEFENDANT [Name]'. Reference FRCP 36."
      ),
      section(
        "statements",
        "Statements for Admission",
        true,
        "Numbered statements for defendant to admit or deny",
        "Draft numbered statements of fact for the defendant to admit or deny under FRCP 36. Target key facts: (1) the defendant received the consumer's dispute, (2) specific information on the credit report is inaccurate, (3) the defendant failed to conduct a reasonable investigation, (4) the defendant continued to report disputed information, (5) the defendant's conduct was willful, (6) the consumer suffered damages. Each statement should be concise, unambiguous, and address a single fact. Include statements about the authenticity of key documents."
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // SETTLEMENT_DEMAND
  // --------------------------------------------------------------------------
  SETTLEMENT_DEMAND: {
    documentType: "SETTLEMENT_DEMAND",
    title: "Settlement Demand Letter",
    disclaimer: AI_DISCLAIMER,
    sections: [
      section(
        "header",
        "Header",
        true,
        "Date, addresses",
        "Include the current date, the consumer's full name and mailing address, and the defendant's name and address (attention to legal department or general counsel if known). Use standard business letter format."
      ),
      section(
        "case_summary",
        "Case Summary",
        true,
        "Brief overview of case and violations",
        "Provide a concise overview of the case: the parties involved, the nature of the credit reporting or debt collection dispute, and a summary of the claims. Reference any prior correspondence, complaints filed, or litigation already commenced."
      ),
      section(
        "violations",
        "Violations",
        true,
        "Detailed violation list with damages",
        "List each violation with its full statutory citation, a description of the defendant's violating conduct, and the associated damages for that violation. Use a structured format (numbered list or table) for clarity."
      ),
      section(
        "damages",
        "Damages Calculation",
        true,
        "Total damages calculation",
        "Present a comprehensive damages calculation: statutory damages per violation (with citations to the authorizing statutes), actual damages (credit denials, emotional distress, out-of-pocket costs), punitive damages exposure (for willful violations), and attorney fees and costs. Show the total exposure to motivate settlement."
      ),
      section(
        "settlement_terms",
        "Settlement Terms",
        true,
        "Proposed settlement (dollar amount, account deletion, credit correction)",
        "State the specific settlement terms proposed: (1) a monetary payment of a specific dollar amount, (2) deletion or correction of all inaccurate information from credit reports, (3) a letter of deletion sent to all affected CRAs, (4) a release of claims upon payment and performance, and (5) any other specific terms (e.g., do-not-contact provisions, compliance undertakings). Make clear this is a good-faith offer."
      ),
      section(
        "deadline",
        "Response Deadline",
        true,
        "Response deadline (typically 21 days)",
        "Set a response deadline of 21 days from the date of the letter. State that if no response is received, the consumer will proceed with litigation (or continue pending litigation) and will seek the full measure of damages, including attorney fees and costs. Reserve all rights."
      ),
    ],
  },
};

// ============================================================================
// Template Lookup
// ============================================================================

/**
 * Looks up and returns the document template for a given document type.
 */
export function getDocumentTemplate(
  documentType: LitigationDocumentType
): DocumentTemplate {
  const template = DOCUMENT_TEMPLATES[documentType];
  if (!template) {
    throw new Error(`No template found for document type: ${documentType}`);
  }
  return template;
}

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Builds the full LLM prompt for generating a legal document.
 *
 * The prompt:
 * 1. Sets the AI role as a legal document drafter specializing in FCRA/FDCPA
 * 2. Specifies the document type being generated
 * 3. Lists each section with its guidance
 * 4. Includes the case context (client, defendant, violations, damages, court)
 * 5. Instructs the AI to output sections with ---SECTION: {id}--- delimiters
 * 6. Appends the disclaimer requirement
 * 7. Instructs formal legal writing style, specific statute citations, proper formatting
 */
export function buildDocumentPrompt(
  template: DocumentTemplate,
  context: DocumentGenerationContext
): string {
  const lines: string[] = [];

  // ---- 1. Role assignment ----
  lines.push(
    "You are an expert legal document drafter specializing in consumer litigation under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681 et seq., and the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692 et seq. You draft precise, professionally formatted legal documents suitable for filing with courts and regulatory agencies."
  );
  lines.push("");

  // ---- 2. Document type ----
  lines.push(`DOCUMENT TYPE: ${template.title} (${template.documentType})`);
  lines.push("");

  // ---- 3. Section guidance ----
  lines.push("DOCUMENT STRUCTURE AND SECTION GUIDANCE:");
  lines.push("Generate the document with the following sections, in order:");
  lines.push("");

  for (const sec of template.sections) {
    lines.push(`  Section: "${sec.label}" (id: ${sec.id})`);
    lines.push(`  Required: ${sec.required ? "Yes" : "No"}`);
    lines.push(`  Description: ${sec.description}`);
    lines.push(`  Guidance: ${sec.promptGuidance}`);
    lines.push("");
  }

  // ---- 4. Case context ----
  lines.push("CASE CONTEXT:");
  lines.push("");

  lines.push("Client Information:");
  lines.push(`  Name: ${context.clientName}`);
  lines.push(`  Address: ${context.clientAddress}, ${context.clientCity}, ${context.clientState} ${context.clientZipCode}`);
  if (context.clientSSNLast4) {
    lines.push(`  SSN (last 4): ***-**-${context.clientSSNLast4}`);
  }
  if (context.clientDOB) {
    lines.push(`  Date of Birth: ${context.clientDOB}`);
  }
  lines.push("");

  if (context.defendantName) {
    lines.push("Defendant Information:");
    lines.push(`  Name: ${context.defendantName}`);
    if (context.defendantType) {
      lines.push(`  Type: ${context.defendantType}`);
    }
    if (context.defendantAddress) {
      lines.push(`  Address: ${context.defendantAddress}`);
    }
    lines.push("");
  }

  lines.push(`Case Number: ${context.caseNumber}`);
  lines.push(`Filing State: ${context.filingState}`);
  if (context.courtType) {
    lines.push(`Court Type: ${context.courtType}`);
  }
  if (context.courtName) {
    lines.push(`Court Name: ${context.courtName}`);
  }
  if (context.courtDistrict) {
    lines.push(`Court District: ${context.courtDistrict}`);
  }
  lines.push("");

  lines.push(`Case Strength: ${context.strengthLabel} (score: ${context.strengthScore})`);
  lines.push(`Total Violations: ${context.totalViolations}`);
  lines.push(
    `Estimated Damages Range: $${(context.estimatedDamagesMin / 100).toLocaleString()} — $${(context.estimatedDamagesMax / 100).toLocaleString()}`
  );
  lines.push("");

  if (context.violations.length > 0) {
    lines.push("Violations:");
    for (const v of context.violations) {
      lines.push(`  - [${v.ruleId}] ${v.title}`);
      lines.push(`    Statute: ${v.statute}`);
      lines.push(`    Severity: ${v.severity} | Category: ${v.category}`);
      lines.push(`    Description: ${v.description}`);
      lines.push(
        `    Damages: $${(v.estimatedDamagesMin / 100).toLocaleString()} — $${(v.estimatedDamagesMax / 100).toLocaleString()}`
      );
      if (v.affectedAccounts.length > 0) {
        lines.push("    Affected Accounts:");
        for (const acct of v.affectedAccounts) {
          let acctLine = `      • ${acct.creditorName}`;
          if (acct.cra) {
            acctLine += ` (CRA: ${acct.cra})`;
          }
          if (acct.balance != null) {
            acctLine += ` — Balance: $${(acct.balance / 100).toLocaleString()}`;
          }
          lines.push(acctLine);
        }
      }
    }
    lines.push("");
  }

  if (context.stateSOL) {
    lines.push("Statute of Limitations (State):");
    lines.push(`  Written Contracts: ${context.stateSOL.writtenContractYears} years`);
    lines.push(`  Oral Contracts: ${context.stateSOL.oralContractYears} years`);
    lines.push("");
  }

  // ---- 5. Output format with section delimiters ----
  lines.push("OUTPUT FORMAT:");
  lines.push(
    "Separate each section of the document using the following delimiter format on its own line:"
  );
  lines.push("");
  lines.push("  ---SECTION: {section_id}---");
  lines.push("");
  lines.push(
    "Where {section_id} matches the id listed in the section guidance above. For example:"
  );
  lines.push("");
  for (const sec of template.sections) {
    lines.push(`  ---SECTION: ${sec.id}---`);
    lines.push(`  [Generated content for ${sec.label}]`);
    lines.push("");
  }

  // ---- 6. Disclaimer requirement ----
  lines.push("DISCLAIMER REQUIREMENT:");
  lines.push(
    "Include the following disclaimer at the very end of the document, after all sections:"
  );
  lines.push("");
  lines.push(`  ${AI_DISCLAIMER}`);
  lines.push("");

  // ---- 7. Style and formatting instructions ----
  lines.push("STYLE AND FORMATTING INSTRUCTIONS:");
  lines.push("- Use formal legal writing style throughout.");
  lines.push(
    "- Cite specific statutes precisely (e.g., 15 U.S.C. § 1681e(b), not just 'the FCRA')."
  );
  lines.push(
    "- Use proper legal formatting: numbered paragraphs for allegations, lettered sub-paragraphs where appropriate."
  );
  lines.push(
    "- Use defined terms consistently (capitalize defined terms, e.g., 'Plaintiff', 'Defendant', 'Consumer Report')."
  );
  lines.push(
    "- Include specific dates, dollar amounts, and account references from the case context."
  );
  lines.push(
    "- Do not fabricate facts, dates, or amounts — use only the information provided in the case context."
  );
  lines.push("- Maintain a professional, authoritative tone appropriate for legal proceedings.");
  lines.push(
    "- For court filings, follow the applicable rules of civil procedure formatting conventions."
  );

  return lines.join("\n");
}
