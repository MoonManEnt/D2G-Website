/**
 * AMELIA Suggestions API
 *
 * POST /api/disputes/[id]/amelia/suggestions - Get AI suggestions for letter improvement
 * PATCH /api/disputes/[id]/amelia/suggestions - Apply a suggestion to the letter
 *
 * This endpoint provides real-time suggestions for improving dispute letters
 * and allows applying those suggestions to update the actual document.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateEOSCARRisk } from "@/lib/eoscar-detection";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Suggestion types that AMELIA can generate
type SuggestionImpact = "high" | "medium" | "low";
type SuggestionCategory = "tone" | "specificity" | "legal" | "emotional" | "dates" | "evidence";

interface AmeliaSuggestion {
  id: string;
  text: string;
  category: SuggestionCategory;
  impact: SuggestionImpact;
  originalText?: string; // The text to find in the letter
  replacementText?: string; // The text to replace it with
  insertionPoint?: string; // Where to insert new text
  insertionText?: string; // Text to insert
  reasoning: string;
}

// Calculate letter statistics
function analyzeLetterContent(content: string) {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const sentenceCount = content.split(/[.!?]+/).filter(Boolean).length;
  const paragraphCount = content.split(/\n\n+/).filter(Boolean).length;

  // Check for key elements
  const hasDates = /\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2}, \d{4}/.test(content);
  const hasAccountNumbers = /\*{2,}|\d{4,}/.test(content);
  const hasLegalCitations = /15 U\.S\.C|§|\d{4}\(|FCRA|FDCPA/i.test(content);
  const hasEmotionalLanguage = /stress|worried|concerned|devastating|hardship|suffering|desperate/i.test(content);
  const hasSpecificDamages = /denied|rejected|unable to|couldn't|prevented|impacted/i.test(content);
  const hasCertifiedMail = /certified mail|tracking|receipt/i.test(content);
  const hasDeadline = /30 day|thirty day|within \d+ day|deadline/i.test(content);

  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    hasDates,
    hasAccountNumbers,
    hasLegalCitations,
    hasEmotionalLanguage,
    hasSpecificDamages,
    hasCertifiedMail,
    hasDeadline,
  };
}

// Generate suggestions based on letter analysis
function generateSuggestions(
  content: string,
  round: number,
  flow: string,
  cra: string
): AmeliaSuggestion[] {
  const analysis = analyzeLetterContent(content);
  const suggestions: AmeliaSuggestion[] = [];

  // Round-specific suggestions
  if (round === 1 && !analysis.hasDates) {
    suggestions.push({
      id: `sug-${Date.now()}-1`,
      text: "Add specific dates from prior communication",
      category: "dates",
      impact: "high",
      insertionPoint: "dispute date",
      insertionText: `On [DATE], I sent my initial dispute via certified mail. `,
      reasoning: "Specific dates establish a clear timeline and demonstrate you've been waiting beyond the 30-day window.",
    });
  }

  if (round >= 2 && !analysis.hasDeadline) {
    suggestions.push({
      id: `sug-${Date.now()}-2`,
      text: "Reference the 30-day timeline requirement",
      category: "legal",
      impact: "high",
      insertionPoint: "investigation",
      insertionText: "Despite the legally mandated 30-day investigation window, ",
      reasoning: "Reinforces that the CRA has exceeded their legal obligations.",
    });
  }

  if (!analysis.hasEmotionalLanguage && round >= 2) {
    suggestions.push({
      id: `sug-${Date.now()}-3`,
      text: "Include emotional impact statement",
      category: "emotional",
      impact: "medium",
      insertionPoint: "closing",
      insertionText: "This situation has caused me significant financial hardship and emotional stress. ",
      reasoning: "Personal impact statements can strengthen the human element of the dispute.",
    });
  }

  if (!analysis.hasSpecificDamages) {
    suggestions.push({
      id: `sug-${Date.now()}-4`,
      text: "Add specific damages you've experienced",
      category: "specificity",
      impact: "high",
      insertionPoint: "impact",
      insertionText: "As a direct result, I have been denied [credit/housing/employment], causing measurable financial harm. ",
      reasoning: "Documenting actual damages strengthens your case significantly.",
    });
  }

  // Tone escalation for later rounds
  if (round >= 3) {
    suggestions.push({
      id: `sug-${Date.now()}-5`,
      text: "Escalate tone for Round " + round,
      category: "tone",
      impact: "medium",
      originalText: "I request",
      replacementText: "I demand",
      reasoning: `Round ${round} warrants more assertive language to signal escalation.`,
    });
  }

  // CRA-specific suggestions
  if (cra === "TRANSUNION" && !content.includes("Chester, PA")) {
    suggestions.push({
      id: `sug-${Date.now()}-6`,
      text: "Verify TransUnion mailing address",
      category: "specificity",
      impact: "low",
      reasoning: "Ensure the letter is addressed to the correct TransUnion dispute address.",
    });
  }

  // Flow-specific suggestions
  if (flow === "COLLECTION" && !content.toLowerCase().includes("debt validation")) {
    suggestions.push({
      id: `sug-${Date.now()}-7`,
      text: "Add debt validation reference",
      category: "legal",
      impact: "high",
      insertionPoint: "validation",
      insertionText: "Furthermore, I have requested debt validation from the alleged creditor but have not received proper documentation. ",
      reasoning: "Collection disputes benefit from referencing debt validation requirements.",
    });
  }

  if (flow === "CONSENT" && !content.toLowerCase().includes("permissible purpose")) {
    suggestions.push({
      id: `sug-${Date.now()}-8`,
      text: "Question permissible purpose",
      category: "legal",
      impact: "high",
      insertionPoint: "inquiry",
      insertionText: "I did not authorize this inquiry and question whether proper permissible purpose existed. ",
      reasoning: "Consent flow disputes should challenge the authorization for the inquiry.",
    });
  }

  return suggestions.slice(0, 5); // Return top 5 suggestions
}

// Calculate AMELIA confidence based on letter quality
function calculateConfidence(content: string, round: number): number {
  const analysis = analyzeLetterContent(content);
  let score = 70; // Base confidence

  if (analysis.hasDates) score += 5;
  if (analysis.hasAccountNumbers) score += 5;
  if (analysis.hasLegalCitations) score += 5;
  if (analysis.hasEmotionalLanguage) score += 3;
  if (analysis.hasSpecificDamages) score += 5;
  if (analysis.hasCertifiedMail) score += 2;
  if (analysis.hasDeadline) score += 3;

  // Word count optimization
  if (analysis.wordCount > 300 && analysis.wordCount < 800) {
    score += 2;
  }

  return Math.min(99, Math.max(60, score));
}

// POST - Get suggestions for the current letter
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        letterContent: true,
        round: true,
        flow: true,
        cra: true,
        aiStrategy: true,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (!dispute.letterContent) {
      return NextResponse.json({ error: "No letter content found" }, { status: 400 });
    }

    // Generate suggestions
    const suggestions = generateSuggestions(
      dispute.letterContent,
      dispute.round,
      dispute.flow,
      dispute.cra
    );

    // Calculate metrics
    const confidence = calculateConfidence(dispute.letterContent, dispute.round);
    const eoscarRisk = calculateEOSCARRisk(dispute.letterContent);
    const analysis = analyzeLetterContent(dispute.letterContent);

    return NextResponse.json({
      suggestions,
      metrics: {
        confidence,
        eoscarRisk,
        wordCount: analysis.wordCount,
        hasAllElements: analysis.hasDates && analysis.hasLegalCitations && analysis.hasSpecificDamages,
      },
      letterPreview: dispute.letterContent.substring(0, 500) + "...",
    });
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}

// PATCH - Apply a suggestion to the letter
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { suggestionId, action, customText } = body;

    if (!suggestionId || !action) {
      return NextResponse.json(
        { error: "Missing suggestionId or action" },
        { status: 400 }
      );
    }

    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (!dispute.letterContent) {
      return NextResponse.json({ error: "No letter content found" }, { status: 400 });
    }

    let updatedContent = dispute.letterContent;

    // Apply the suggestion based on action type
    if (action === "apply" && body.originalText && body.replacementText) {
      // Replace text
      updatedContent = updatedContent.replace(body.originalText, body.replacementText);
    } else if (action === "insert" && body.insertionText) {
      // Insert text at the end of a paragraph or specific location
      if (body.insertionPoint === "closing") {
        const closingIndex = updatedContent.lastIndexOf("Sincerely");
        if (closingIndex > 0) {
          updatedContent =
            updatedContent.substring(0, closingIndex) +
            body.insertionText + "\n\n" +
            updatedContent.substring(closingIndex);
        }
      } else {
        // Insert at the end before closing
        const closingIndex = updatedContent.lastIndexOf("Sincerely");
        if (closingIndex > 0) {
          updatedContent =
            updatedContent.substring(0, closingIndex) +
            body.insertionText + "\n\n" +
            updatedContent.substring(closingIndex);
        } else {
          updatedContent += "\n\n" + body.insertionText;
        }
      }
    } else if (action === "custom" && customText) {
      // Apply custom text modification
      if (body.originalText) {
        updatedContent = updatedContent.replace(body.originalText, customText);
      }
    }

    // Update the dispute with new content
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        letterContent: updatedContent,
      },
    });

    // Also update the document if it exists
    const document = await prisma.document.findFirst({
      where: {
        disputeId: disputeId,
        documentType: "DISPUTE_LETTER",
      },
    });

    if (document) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          content: updatedContent,
        },
      });
    }

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DOCUMENT_EDITED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "DISPUTE",
        targetId: disputeId,
        eventData: JSON.stringify({
          action: "AMELIA_SUGGESTION_APPLIED",
          suggestionId,
          actionType: action,
        }),
        organizationId: session.user.organizationId,
      },
    });

    // Recalculate metrics after change
    const confidence = calculateConfidence(updatedContent, dispute.round);
    const eoscarRisk = calculateEOSCARRisk(updatedContent);

    return NextResponse.json({
      success: true,
      letterContent: updatedContent,
      metrics: {
        confidence,
        eoscarRisk,
      },
    });
  } catch (error) {
    console.error("Error applying suggestion:", error);
    return NextResponse.json(
      { error: "Failed to apply suggestion" },
      { status: 500 }
    );
  }
}

// PUT - Update the entire letter content
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { letterContent } = body;

    if (!letterContent) {
      return NextResponse.json({ error: "Missing letterContent" }, { status: 400 });
    }

    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Update the dispute
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        letterContent,
      },
    });

    // Also update the document if it exists
    const document = await prisma.document.findFirst({
      where: {
        disputeId: disputeId,
        documentType: "DISPUTE_LETTER",
      },
    });

    if (document) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          content: letterContent,
        },
      });
    }

    // Recalculate metrics
    const confidence = calculateConfidence(letterContent, dispute.round);
    const eoscarRisk = calculateEOSCARRisk(letterContent);

    return NextResponse.json({
      success: true,
      metrics: {
        confidence,
        eoscarRisk,
      },
    });
  } catch (error) {
    console.error("Error updating letter:", error);
    return NextResponse.json(
      { error: "Failed to update letter" },
      { status: 500 }
    );
  }
}
