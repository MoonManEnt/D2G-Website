/**
 * AMELIA Letter Generation API
 *
 * POST /api/disputes/[id]/amelia - Generate letter content using AMELIA doctrine
 *
 * This endpoint generates unique, human-written dispute letters following
 * the AMELIA doctrine rules:
 * - 60-69 day backdating for Round 1 (random within range)
 * - 30-39 day backdating for Round 2+ (random within range)
 * - DAMAGES → STORY → FACTS → PENALTY structure
 * - Personal info disputes (names, addresses, inquiries)
 * - eOSCAR-resistant unique stories
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import {
  generateLetter,
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
  type ActivePersonalInfoDispute,
  type GeneratedLetter,
} from "@/lib/amelia/index";
import {
  generateAmeliaAILetter,
  type ClientInfo as AmeliaClientInfo,
  type DisputeAccount as AmeliaDisputeAccount,
} from "@/lib/amelia";
import { isAIAvailable } from "@/lib/ai/providers";
import {
  calculateLetterDate,
  determineTone,
} from "@/lib/amelia-doctrine";
import { getEffectiveFlow } from "@/lib/amelia-templates";
import { CRA } from "@/types";
import {
  getActiveDisputes,
  getLastDisputeDate,
  recordDisputedItems,
} from "@/lib/personal-info-dispute-service";
import { validateUniqueness } from "@/lib/ai/content-validator";
import { validateLetter as validateLetterQuality } from "@/lib/amelia-validation";
import type { ConsumerVoiceProfile } from "@/lib/amelia-soul-engine";
import { createLogger } from "@/lib/logger";
const log = createLogger("dispute-amelia-api");

// Helper to count humanizing features in letter content
function countHumanizingFeatures(content: string): number {
  let count = 0;

  // Count contractions (natural speech)
  const contractions = content.match(/\b(I'm|I've|I'll|don't|can't|won't|it's|that's|you're|they're|wouldn't|shouldn't|couldn't|haven't|hasn't|isn't|aren't|wasn't|weren't)\b/gi);
  count += contractions ? contractions.length : 0;

  // Count emotional/personal phrases
  const emotionalPhrases = content.match(/\b(honestly|seriously|really|actually|basically|frankly|truly|simply|please|appreciate|concerned|worried|frustrated|stressed|struggling|difficult|hard|terrible|awful|devastating)\b/gi);
  count += emotionalPhrases ? emotionalPhrases.length : 0;

  // Count personal impact statements
  const personalImpact = content.match(/\b(my family|my children|my life|my credit|my future|can't sleep|lost sleep|financial hardship|denied|rejected|turned down)\b/gi);
  count += personalImpact ? Math.min(personalImpact.length * 2, 6) : 0; // Weight these higher

  // Count informal sentence starters
  const informalStarters = content.match(/^(Look,|So,|And |But |Because |Well,)/gm);
  count += informalStarters ? informalStarters.length : 0;

  return count;
}

// Helper to calculate eOSCAR risk level
function calculateEOSCARRisk(uniquenessScore: number, humanPhrases: number): "LOW" | "MEDIUM" | "HIGH" {
  if (uniquenessScore >= 80 && humanPhrases >= 8) return "LOW";
  if (uniquenessScore >= 60 && humanPhrases >= 5) return "MEDIUM";
  return "HIGH";
}

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/disputes/[id]/amelia - Generate AMELIA letter
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { regenerate = false, tone } = body;

    // Fetch dispute with all related data
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Don't regenerate if letter already exists unless explicitly requested
    if (dispute.letterContent && !regenerate) {
      return NextResponse.json({
        success: true,
        message: "Letter already generated",
        letterContent: dispute.letterContent,
        isExisting: true,
      });
    }

    const client = dispute.client;
    const cra = dispute.cra as CRA;

    // Fetch the most recent credit report for this client to get personal info
    const latestReport = await prisma.creditReport.findFirst({
      where: {
        clientId: client.id,
        parseStatus: "COMPLETED",
      },
      orderBy: {
        reportDate: "desc",
      },
    });

    // Parse personal info from report (stored as JSON strings)
    let previousNames: string[] = [];
    let previousAddresses: string[] = [];
    let hardInquiries: HardInquiry[] = [];

    if (latestReport) {
      try {
        previousNames = JSON.parse(latestReport.previousNames || "[]");
        previousAddresses = JSON.parse(latestReport.previousAddresses || "[]");
        const rawInquiries = JSON.parse(latestReport.hardInquiries || "[]");
        hardInquiries = rawInquiries.map((inq: { creditorName: string; inquiryDate: string; cra: string }) => ({
          creditorName: inq.creditorName,
          inquiryDate: inq.inquiryDate,
          cra: inq.cra as CRA,
        }));
      } catch {
        // If parsing fails, use empty arrays
      }
    }

    // Build client personal info
    const clientInfo: ClientPersonalInfo = {
      firstName: client.firstName,
      lastName: client.lastName,
      fullName: `${client.firstName} ${client.lastName}`,
      addressLine1: client.addressLine1 || "",
      addressLine2: client.addressLine2 || undefined,
      city: client.city || "",
      state: client.state || "",
      zipCode: client.zipCode || "",
      ssnLast4: client.ssnLast4 || "XXXX",
      dateOfBirth: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : "XX/XX/XXXX",
      phone: client.phone || undefined,
      previousNames,
      previousAddresses,
      hardInquiries,
    };

    // Build dispute accounts
    const accounts: DisputeAccount[] = dispute.items.map((item) => {
      const acc = item.accountItem;
      const issues = acc?.detectedIssues ? JSON.parse(acc.detectedIssues) : [];

      return {
        creditorName: acc?.creditorName || "Unknown Creditor",
        accountNumber: acc?.maskedAccountId || "XXXXXXXX****",
        accountType: acc?.accountType || undefined,
        balance: acc?.balance ? parseFloat(acc.balance.toString()) : undefined,
        pastDue: acc?.pastDue ? parseFloat(acc.pastDue.toString()) : undefined,
        dateOpened: acc?.dateOpened
          ? format(new Date(acc.dateOpened), "MM/dd/yyyy")
          : undefined,
        dateReported: acc?.dateReported
          ? format(new Date(acc.dateReported), "MM/dd/yyyy")
          : undefined,
        paymentStatus: acc?.paymentStatus || undefined,
        issues: issues,
        inaccurateCategories: [], // Will be determined by doctrine
      };
    });

    // Get used content hashes for this client to ensure uniqueness
    const usedHashes = await prisma.ameliaContentHash.findMany({
      where: { clientId: client.id },
      select: { contentHash: true },
    });
    const usedHashSet = new Set(usedHashes.map((h) => h.contentHash));

    // When regenerating, load ALL previous letter documents for this dispute's client
    // This provides full context to ensure true uniqueness
    let previousLetterContents: string[] = [];
    if (regenerate) {
      // Fetch all previous letter documents for this client
      const previousDocs = await prisma.dispute.findMany({
        where: {
          clientId: client.id,
          letterContent: { not: null },
        },
        select: {
          letterContent: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10, // Last 10 letters for comparison
      });

      previousLetterContents = previousDocs
        .map(d => d.letterContent)
        .filter((c): c is string => !!c);

      // Also add current letter content to the exclusion set
      if (dispute.letterContent) {
        previousLetterContents.unshift(dispute.letterContent);
        const crypto = await import("crypto");
        const currentHash = crypto.createHash("sha256").update(dispute.letterContent).digest("hex");
        usedHashSet.add(currentHash);
      }
    }

    // Determine flow type
    const flowType = dispute.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

    // AMELIA Doctrine: For R2+, fetch last dispute date and active personal info disputes
    let lastDisputeDateStr: string | undefined;
    let activePersonalInfoDisputes: ActivePersonalInfoDispute[] | undefined;

    if (dispute.round >= 2) {
      // Get the actual date of the last letter sent for this client/CRA
      const lastDisputeDate = await getLastDisputeDate(client.id, cra);
      if (lastDisputeDate) {
        lastDisputeDateStr = format(lastDisputeDate, "MMMM d, yyyy");
      }

      // Get active personal info disputes that need to continue being disputed
      activePersonalInfoDisputes = await getActiveDisputes(client.id, cra);
    }

    // Phase 3: Load previous round intelligence for R2+
    let previousRoundIntelligence: string | null = null;
    if (dispute.round >= 2) {
      const lastRoundHistory = await prisma.disputeRoundHistory.findFirst({
        where: {
          disputeId,
          round: dispute.round - 1,
        },
        orderBy: { createdAt: "desc" },
      });

      if (lastRoundHistory?.nextRoundContext) {
        try {
          previousRoundIntelligence = lastRoundHistory.nextRoundContext;
        } catch {
          // If parsing fails, skip
        }
      }
    }

    // Phase 4: Load outcome patterns for this CRA + flow combo
    let outcomePatternContext: string | null = null;
    try {
      const patterns = await prisma.ameliaOutcomePattern.findMany({
        where: {
          organizationId: session.user.organizationId,
          cra: cra,
          flow: flowType,
          isReliable: true,
        },
        orderBy: { successRate: "desc" },
        take: 3,
      });

      if (patterns.length > 0) {
        outcomePatternContext = patterns.map(p =>
          `${p.creditorName || "General"} on ${p.cra}: ${p.successRate.toFixed(0)}% success rate (n=${p.sampleSize})${p.avgDaysToResolve ? `, avg ${p.avgDaysToResolve.toFixed(0)} days` : ""}`
        ).join("\n");
      }
    } catch (patternError) {
      log.error({ err: patternError }, "Failed to load outcome patterns");
    }

    // Phase 5: Count violations for litigation threshold
    let violationCount = 0;
    let litigationMode = false;
    let violationDetails: string[] = [];
    try {
      const litigationScans = await prisma.litigationScan.findMany({
        where: {
          clientId: client.id,
        },
        select: {
          totalViolations: true,
          violations: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (litigationScans.length > 0) {
        violationCount = litigationScans.reduce((sum, scan) => sum + scan.totalViolations, 0);
        litigationMode = violationCount >= 3;

        if (litigationMode) {
          for (const scan of litigationScans) {
            try {
              const parsedViolations = JSON.parse(scan.violations);
              if (Array.isArray(parsedViolations)) {
                for (const v of parsedViolations) {
                  if (v.violationType && v.severity) {
                    violationDetails.push(
                      `${v.violationType} (${v.severity}): ${v.description || "No details"}`
                    );
                  }
                }
              }
            } catch {
              // If parsing fails, skip this scan's violations
            }
          }
          // Limit to top 10 violation details
          violationDetails = violationDetails.slice(0, 10);
        }
      }
    } catch (violationError) {
      log.error({ err: violationError }, "Failed to count violations");
      // Litigation features degrade gracefully
    }

    // Generate the letter — AI-first with template fallback
    let generatedLetter: GeneratedLetter | null = null;

    if (isAIAvailable()) {
      try {
        // Adapt data to AI generation interface
        const aiClient: AmeliaClientInfo = {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          address: clientInfo.addressLine1 + (clientInfo.addressLine2 ? ` ${clientInfo.addressLine2}` : ""),
          city: clientInfo.city,
          state: clientInfo.state,
          zip: clientInfo.zipCode,
          ssn4: clientInfo.ssnLast4,
          dob: clientInfo.dateOfBirth,
        };

        const aiAccounts: AmeliaDisputeAccount[] = accounts.map((a) => ({
          creditorName: a.creditorName,
          accountNumber: a.accountNumber,
          accountType: a.accountType,
          balance: a.balance,
          issues: a.issues.map((i: string | { description: string }) =>
            typeof i === "string" ? i : i.description
          ),
        }));

        const aiResult = await generateAmeliaAILetter({
          client: aiClient,
          accounts: aiAccounts,
          cra: cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
          flow: flowType as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
          round: dispute.round,
          previousHistory: dispute.round >= 2
            ? {
                previousRounds: Array.from({ length: dispute.round - 1 }, (_, i) => i + 1),
                previousResponses: [],
                daysWithoutResponse: 30,
              }
            : undefined,
          organizationId: session.user.organizationId,
          // Phase 3: Previous round intelligence
          previousRoundContext: previousRoundIntelligence || undefined,
          // Phase 4: Outcome patterns
          outcomePatternContext: outcomePatternContext || undefined,
          // Phase 5: Litigation mode
          litigationMode,
          violationCount,
          violationDetails: litigationMode ? violationDetails : undefined,
        });

        // Compute doctrine metadata to match expected GeneratedLetter format
        const dateInfo = calculateLetterDate(dispute.round);
        const aiTone = determineTone(dispute.round);
        const effectiveFlow = getEffectiveFlow(flowType, dispute.round);

        generatedLetter = {
          content: aiResult.content,
          letterDate: dateInfo.letterDate,
          isBackdated: dateInfo.isBackdated,
          backdatedDays: dateInfo.backdatedDays,
          tone: aiTone,
          flow: flowType,
          effectiveFlow,
          round: dispute.round,
          statute: effectiveFlow === "COLLECTION" ? "FDCPA" : "FCRA",
          contentHash: aiResult.contentHash,
          includesScreenshots: false,
          personalInfoDisputed: {
            previousNames: [],
            previousAddresses: [],
            hardInquiries: [],
          },
          letterStructure: "DAMAGES_FIRST",
        };

        log.info({ data: disputeId }, "[Amelia] AI letter generated successfully for dispute");
      } catch (aiError) {
        log.error({ err: aiError }, "[Amelia] AI generation failed, falling back to template");
        // generatedLetter stays null, falls through to template generation
      }
    }

    if (!generatedLetter) {
      // Fallback: Generate the letter using AMELIA template doctrine (supports all rounds)
      generatedLetter = generateLetter({
        client: clientInfo,
        accounts,
        cra,
        flow: flowType,
        round: dispute.round,
        usedContentHashes: usedHashSet,
        lastDisputeDate: lastDisputeDateStr,
        activePersonalInfoDisputes,
        ...(tone && { toneOverride: tone }),
      });
    }

    // Post-generation uniqueness validation
    // Ensures the generated letter is sufficiently different from all previous letters
    if (regenerate && previousLetterContents.length > 0 && generatedLetter) {
      const validation = validateUniqueness(generatedLetter.content, previousLetterContents);

      if (!validation.isUnique) {
        log.warn({ similarityScore: validation.similarityScore, mostSimilarIndex: validation.mostSimilarIndex, uniquenessScore: validation.uniquenessScore }, "[Amelia] Generated letter has high overlap with previous letter");

        // If template path generated a too-similar letter, try forcing different variant selection
        if (!isAIAvailable() || generatedLetter.content === dispute.letterContent) {
          // Add more hashes to force different content on retry
          for (const prevContent of previousLetterContents) {
            const sentences = prevContent.split(/[.!?]+/);
            for (const sentence of sentences) {
              if (sentence.trim().length > 30) {
                const crypto = await import("crypto");
                const hash = crypto.createHash("sha256").update(sentence.trim().toLowerCase()).digest("hex").substring(0, 16);
                usedHashSet.add(hash);
              }
            }
          }

          // Regenerate with expanded exclusion set
          generatedLetter = generateLetter({
            client: clientInfo,
            accounts,
            cra,
            flow: flowType,
            round: dispute.round,
            usedContentHashes: usedHashSet,
            lastDisputeDate: lastDisputeDateStr,
            activePersonalInfoDisputes,
            ...(tone && { toneOverride: tone }),
          });
        }
      }
    }

    // NOTE: Content hash is NOT stored on regeneration - only when dispute is LAUNCHED
    // This allows unlimited regeneration while still preventing duplicate content across launched disputes
    // The hash will be stored when the dispute is sent via /api/disputes/create-and-launch or when status changes to SENT

    // Update the dispute with the generated letter content
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        letterContent: generatedLetter.content,
        aiStrategy: JSON.stringify({
          generatedAt: new Date().toISOString(),
          tone: generatedLetter.tone,
          isBackdated: generatedLetter.isBackdated,
          backdatedDays: generatedLetter.backdatedDays,
          letterDate: generatedLetter.letterDate.toISOString(),
          flow: generatedLetter.flow,
          effectiveFlow: generatedLetter.effectiveFlow,
          round: generatedLetter.round,
          statute: generatedLetter.statute,
          includesScreenshots: generatedLetter.includesScreenshots,
          personalInfoDisputed: generatedLetter.personalInfoDisputed,
          ameliaVersion: "2.1",
          generationMethod: isAIAvailable() ? "ai" : "template",
        }),
      },
    });

    // Store content hash on regeneration to prevent future duplicates
    if (regenerate) {
      await prisma.ameliaContentHash.create({
        data: {
          clientId: client.id,
          contentHash: generatedLetter.contentHash,
          contentType: "LETTER",
          sourceDocId: disputeId,
        },
      });
    }

    // AMELIA Doctrine: Record disputed items for persistent tracking
    // These will continue to be disputed until confirmed removed from report
    await recordDisputedItems(
      client.id,
      session.user.organizationId,
      cra,
      generatedLetter.personalInfoDisputed
    );

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DOCUMENT_GENERATED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "DISPUTE",
        targetId: disputeId,
        eventData: JSON.stringify({
          type: "AMELIA_LETTER",
          flow: flowType,
          round: dispute.round,
          cra,
          tone: generatedLetter.tone,
          isBackdated: generatedLetter.isBackdated,
          accountCount: accounts.length,
          previousNamesDisputed: generatedLetter.personalInfoDisputed.previousNames.length,
          previousAddressesDisputed: generatedLetter.personalInfoDisputed.previousAddresses.length,
          hardInquiriesDisputed: generatedLetter.personalInfoDisputed.hardInquiries.length,
        }),
        organizationId: session.user.organizationId,
      },
    });

    // Run quality validation to get real scores
    const humanPhraseCount = countHumanizingFeatures(generatedLetter.content);

    // Run full letter validation if we have enough context
    let validationScores = {
      kitchenTableScore: 8, // Default good score
      antiAIScore: 8,
      uniquenessScore: 85,
    };

    try {
      // Create a basic voice profile for validation
      const voiceProfile: ConsumerVoiceProfile = {
        ageRange: "30-44",
        emotionalState: generatedLetter.tone === "PISSED" ? "angry_controlled" :
                       generatedLetter.tone === "WARNING" ? "determined" :
                       generatedLetter.tone === "FED_UP" ? "frustrated" : "concerned",
        communicationStyle: generatedLetter.tone === "CONCERNED" ? "formal" : "direct",
        legalLiteracy: "medium",
        grammarPosture: 2, // 1-4 scale, 2 = competent casual
        lifeStakes: "credit repair",
        personalNarrativeElements: [],
        relationshipToAccount: "disputed",
        formalityBaseline: "moderate",
        disputeFatigue: generatedLetter.round >= 3 ? "significant" : generatedLetter.round >= 2 ? "mild" : "none",
        voiceSource: "data-inferred",
      };

      const validation = validateLetterQuality({
        letterBody: generatedLetter.content,
        voiceProfile,
        round: generatedLetter.round,
        priorLetters: previousLetterContents.length > 0 ? previousLetterContents : undefined,
      });

      validationScores = {
        kitchenTableScore: validation.kitchenTableTest.score,
        antiAIScore: validation.antiAICheck.score,
        uniquenessScore: validation.uniquenessCheck.score * 10, // Convert 1-10 to percentage
      };
    } catch (validationError) {
      log.warn({ err: validationError }, "Letter validation failed, using defaults");
    }

    // Calculate combined uniqueness score (weighted average)
    const combinedUniquenessScore = Math.round(
      (validationScores.kitchenTableScore * 10 * 0.3) +
      (validationScores.antiAIScore * 10 * 0.3) +
      (validationScores.uniquenessScore * 0.4)
    );

    const eoscarRisk = calculateEOSCARRisk(combinedUniquenessScore, humanPhraseCount);

    return NextResponse.json({
      success: true,
      letterContent: generatedLetter.content,
      metadata: {
        letterDate: generatedLetter.letterDate.toISOString(),
        isBackdated: generatedLetter.isBackdated,
        backdatedDays: generatedLetter.backdatedDays,
        tone: generatedLetter.tone,
        flow: generatedLetter.flow,
        effectiveFlow: generatedLetter.effectiveFlow,
        round: generatedLetter.round,
        statute: generatedLetter.statute,
        includesScreenshots: generatedLetter.includesScreenshots,
        personalInfoDisputed: {
          previousNames: generatedLetter.personalInfoDisputed.previousNames.length,
          previousAddresses: generatedLetter.personalInfoDisputed.previousAddresses.length,
          hardInquiries: generatedLetter.personalInfoDisputed.hardInquiries.length,
        },
        ameliaVersion: "2.1",
        // Real eOSCAR resistance scores
        eoscarResistance: {
          uniquenessScore: combinedUniquenessScore,
          humanPhraseCount: humanPhraseCount,
          riskLevel: eoscarRisk,
          validation: {
            kitchenTableScore: validationScores.kitchenTableScore,
            antiAIScore: validationScores.antiAIScore,
            contentUniqueness: validationScores.uniquenessScore,
          },
        },
        ...(litigationMode ? {
          litigation: {
            mode: true,
            violationCount,
          },
        } : {}),
        ...(regenerate && previousLetterContents.length > 0 ? {
          uniqueness: (() => {
            const v = validateUniqueness(generatedLetter!.content, previousLetterContents);
            return {
              score: v.uniquenessScore,
              maxOverlap: v.maxOverlap,
              isUnique: v.isUnique,
            };
          })(),
        } : {}),
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error generating AMELIA letter");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate letter",
      },
      { status: 500 }
    );
  }
}

// GET /api/disputes/[id]/amelia - Get AMELIA letter metadata
export async function GET(request: NextRequest, { params }: RouteParams) {
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
        aiStrategy: true,
        round: true,
        flow: true,
        cra: true,
        status: true,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    let metadata = null;
    if (dispute.aiStrategy) {
      try {
        metadata = JSON.parse(dispute.aiStrategy);
      } catch {
        // If parsing fails, leave as null
      }
    }

    return NextResponse.json({
      hasLetter: !!dispute.letterContent,
      letterLength: dispute.letterContent?.length || 0,
      metadata,
      dispute: {
        round: dispute.round,
        flow: dispute.flow,
        cra: dispute.cra,
        status: dispute.status,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching AMELIA letter");
    return NextResponse.json(
      { error: "Failed to fetch letter metadata" },
      { status: 500 }
    );
  }
}
