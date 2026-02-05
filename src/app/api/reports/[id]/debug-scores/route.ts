import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { extractTextFromPDF, extractTextFromBuffer } from "@/lib/pdf-extract";
import { extractCreditScores } from "@/lib/parser";
import { readFile } from "fs/promises";
import { createLogger } from "@/lib/logger";
const log = createLogger("report-debug-scores-api");

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/[id]/debug-scores - Debug credit score extraction
 *
 * Returns the extracted text and score patterns to help diagnose
 * why scores may not be parsing correctly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: reportId } = await params;

    // Get report with original file
    const report = await prisma.creditReport.findFirst({
      where: {
        id: reportId,
        organizationId: session.user.organizationId,
      },
      include: {
        originalFile: true,
      },
    });

    if (!report || !report.originalFile) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Get existing scores from database
    const existingScores = await prisma.creditScore.findMany({
      where: {
        reportId,
      },
      select: {
        cra: true,
        score: true,
        scoreType: true,
      },
    });

    // Try to extract text from PDF
    let extractionResult;
    const storagePath = report.originalFile.storagePath;

    if (storagePath.startsWith("http")) {
      // Vercel Blob URL - fetch and extract
      const response = await fetch(storagePath);
      const buffer = Buffer.from(await response.arrayBuffer());
      extractionResult = await extractTextFromBuffer(buffer);
    } else {
      // Local file
      try {
        extractionResult = await extractTextFromPDF(storagePath);
      } catch {
        return NextResponse.json({
          error: "Could not read PDF file",
          storagePath,
        }, { status: 500 });
      }
    }

    if (!extractionResult.success) {
      return NextResponse.json({
        error: "PDF extraction failed",
        extractionError: extractionResult.error,
      }, { status: 500 });
    }

    // Extract scores using the parser
    const extractedScores = extractCreditScores(extractionResult.text);

    // Find score-related text sections
    const fullText = extractionResult.text;

    // Search for various score-related patterns in the text
    const scorePatterns = {
      transunionMentions: [...fullText.matchAll(/TransUnion[\s\S]{0,100}/gi)].map(m => m[0]),
      equifaxMentions: [...fullText.matchAll(/Equifax[\s\S]{0,100}/gi)].map(m => m[0]),
      experianMentions: [...fullText.matchAll(/Experian[\s\S]{0,100}/gi)].map(m => m[0]),
      scoreMentions: [...fullText.matchAll(/(?:credit\s*)?score[\s\S]{0,100}/gi)].map(m => m[0]),
      vantageScoreMentions: [...fullText.matchAll(/vantage[\s\S]{0,100}/gi)].map(m => m[0]),
      threeDigitNumbers: [...fullText.matchAll(/\b([3-8]\d{2})\b/g)].map(m => m[1]),
    };

    // Get first 2000 chars of text for review
    const textSample = fullText.substring(0, 2000);

    // Find the "Credit Score Summary" section if it exists
    const scoreSummaryMatch = fullText.match(/credit\s*score[\s\S]{0,500}/i);
    const scoreSummarySection = scoreSummaryMatch ? scoreSummaryMatch[0] : null;

    return NextResponse.json({
      reportId,
      textLength: fullText.length,
      pageCount: extractionResult.pageCount,
      existingScoresInDB: existingScores,
      extractedScores,
      scorePatterns: {
        transunionMentions: scorePatterns.transunionMentions.slice(0, 5),
        equifaxMentions: scorePatterns.equifaxMentions.slice(0, 5),
        experianMentions: scorePatterns.experianMentions.slice(0, 5),
        scoreMentions: scorePatterns.scoreMentions.slice(0, 5),
        vantageScoreMentions: scorePatterns.vantageScoreMentions.slice(0, 5),
        potentialScores: [...new Set(scorePatterns.threeDigitNumbers.filter(n => {
          const num = parseInt(n, 10);
          return num >= 300 && num <= 850;
        }))].slice(0, 20),
      },
      scoreSummarySection,
      textSample,
    });
  } catch (error) {
    log.error({ err: error }, "Debug scores error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
