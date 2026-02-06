/**
 * AMELIA Section Parser
 *
 * Parses AI-generated letter output that uses section markers.
 * Extracts each section for individual validation and assembly.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedLetterSections {
  header: string;
  headline: string;
  opening: string;
  bodyFacts: string;
  accountList: string;
  corrections: string;
  consumerStatement: string;
  closing: string;
}

export interface ParseResult {
  success: boolean;
  sections: ParsedLetterSections;
  missingSections: string[];
  rawOutput: string;
}

// =============================================================================
// SECTION MARKERS
// =============================================================================

const SECTION_MARKERS = {
  header: { start: "<SECTION:HEADER>", end: "</SECTION:HEADER>" },
  headline: { start: "<SECTION:HEADLINE>", end: "</SECTION:HEADLINE>" },
  opening: { start: "<SECTION:OPENING>", end: "</SECTION:OPENING>" },
  bodyFacts: { start: "<SECTION:BODY_FACTS>", end: "</SECTION:BODY_FACTS>" },
  accountList: { start: "<SECTION:ACCOUNT_LIST>", end: "</SECTION:ACCOUNT_LIST>" },
  corrections: { start: "<SECTION:CORRECTIONS>", end: "</SECTION:CORRECTIONS>" },
  consumerStatement: { start: "<SECTION:CONSUMER_STATEMENT>", end: "</SECTION:CONSUMER_STATEMENT>" },
  closing: { start: "<SECTION:CLOSING>", end: "</SECTION:CLOSING>" },
};

// =============================================================================
// PARSING FUNCTIONS
// =============================================================================

/**
 * Extract a single section from the raw output
 */
function extractSection(
  rawOutput: string,
  startMarker: string,
  endMarker: string
): string | null {
  const startIndex = rawOutput.indexOf(startMarker);
  const endIndex = rawOutput.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const content = rawOutput
    .substring(startIndex + startMarker.length, endIndex)
    .trim();

  return content || null;
}

/**
 * Parse the full AI output into sections
 */
export function parseLetterSections(rawOutput: string): ParseResult {
  const sections: ParsedLetterSections = {
    header: "",
    headline: "",
    opening: "",
    bodyFacts: "",
    accountList: "",
    corrections: "",
    consumerStatement: "",
    closing: "",
  };

  const missingSections: string[] = [];

  // Extract each section
  for (const [sectionName, markers] of Object.entries(SECTION_MARKERS)) {
    const content = extractSection(rawOutput, markers.start, markers.end);

    if (content) {
      sections[sectionName as keyof ParsedLetterSections] = content;
    } else {
      missingSections.push(sectionName);
    }
  }

  // Check for required sections
  const requiredSections = ["opening", "bodyFacts", "accountList", "corrections", "consumerStatement"];
  const missingRequired = requiredSections.filter(s => !sections[s as keyof ParsedLetterSections]);

  return {
    success: missingRequired.length === 0,
    sections,
    missingSections,
    rawOutput,
  };
}

/**
 * Try to parse without markers (fallback for AI that doesn't follow instructions)
 */
export function parseWithoutMarkers(rawOutput: string): ParseResult {
  // Split by common section indicators
  const lines = rawOutput.split("\n");
  const sections: ParsedLetterSections = {
    header: "",
    headline: "",
    opening: "",
    bodyFacts: "",
    accountList: "",
    corrections: "",
    consumerStatement: "",
    closing: "",
  };

  let currentSection = "header";
  let currentContent: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();

    // Detect section changes based on content
    if (lowerLine.includes("re:") || lowerLine.includes("subject:") || lowerLine.includes("factual dispute")) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection as keyof ParsedLetterSections] = currentContent.join("\n").trim();
        currentContent = [];
      }
      currentSection = "headline";
    } else if (lowerLine.includes("dear ") && currentSection === "headline") {
      sections.headline = currentContent.join("\n").trim();
      currentContent = [];
      currentSection = "opening";
    } else if (
      (lowerLine.includes("here is") && lowerLine.includes("inaccurate")) ||
      (lowerLine.includes("following accounts") || lowerLine.includes("account name:"))
    ) {
      if (currentContent.length > 0 && currentSection === "opening") {
        sections.opening = currentContent.join("\n").trim();
        currentContent = [];
      }
      currentSection = currentSection === "opening" ? "bodyFacts" : "accountList";
    } else if (
      lowerLine.includes("correction") ||
      lowerLine.includes("deletion") ||
      lowerLine.includes("requested action")
    ) {
      if (currentContent.length > 0) {
        sections[currentSection as keyof ParsedLetterSections] = currentContent.join("\n").trim();
        currentContent = [];
      }
      currentSection = "corrections";
    } else if (
      lowerLine.includes("consumer statement") ||
      lowerLine.includes("statement:") ||
      lowerLine.includes("in closing")
    ) {
      if (currentContent.length > 0) {
        sections[currentSection as keyof ParsedLetterSections] = currentContent.join("\n").trim();
        currentContent = [];
      }
      currentSection = "consumerStatement";
    } else if (lowerLine.includes("sincerely") || lowerLine.includes("respectfully")) {
      if (currentContent.length > 0) {
        sections[currentSection as keyof ParsedLetterSections] = currentContent.join("\n").trim();
        currentContent = [];
      }
      currentSection = "closing";
    }

    currentContent.push(line);
  }

  // Save final section
  if (currentContent.length > 0) {
    sections[currentSection as keyof ParsedLetterSections] = currentContent.join("\n").trim();
  }

  // Determine what's missing
  const missingSections: string[] = [];
  for (const [name, content] of Object.entries(sections)) {
    if (!content) {
      missingSections.push(name);
    }
  }

  const requiredSections = ["opening", "bodyFacts", "accountList", "corrections", "consumerStatement"];
  const missingRequired = requiredSections.filter(s => !sections[s as keyof ParsedLetterSections]);

  return {
    success: missingRequired.length === 0,
    sections,
    missingSections,
    rawOutput,
  };
}

/**
 * Assemble sections into final letter
 */
export function assembleLetter(sections: ParsedLetterSections): string {
  const parts: string[] = [];

  // Header
  if (sections.header) {
    parts.push(sections.header);
    parts.push("");
  }

  // Headline
  if (sections.headline) {
    parts.push(sections.headline);
    parts.push("");
  }

  // Opening
  if (sections.opening) {
    parts.push(sections.opening);
    parts.push("");
  }

  // Body facts
  if (sections.bodyFacts) {
    parts.push(sections.bodyFacts);
    parts.push("");
  }

  // Account list
  if (sections.accountList) {
    parts.push(sections.accountList);
    parts.push("");
  }

  // Corrections
  if (sections.corrections) {
    parts.push(sections.corrections);
    parts.push("");
  }

  // Consumer statement
  if (sections.consumerStatement) {
    parts.push(`Consumer Statement: ${sections.consumerStatement}`);
    parts.push("");
  }

  // Closing
  if (sections.closing) {
    parts.push(sections.closing);
  }

  // Join and clean up excessive newlines
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Get section names for iteration
 */
export function getSectionNames(): (keyof ParsedLetterSections)[] {
  return [
    "header",
    "headline",
    "opening",
    "bodyFacts",
    "accountList",
    "corrections",
    "consumerStatement",
    "closing",
  ];
}

/**
 * Check if a section is required
 */
export function isSectionRequired(sectionName: string): boolean {
  const required = ["opening", "bodyFacts", "accountList", "corrections", "consumerStatement"];
  return required.includes(sectionName);
}
