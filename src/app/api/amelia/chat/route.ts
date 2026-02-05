export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { streamLLM } from "@/lib/llm-orchestrator";
import { convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import {
  assembleClientContext,
  formatContextForPrompt,
} from "@/lib/ai/context-assembler";
import { createLogger } from "@/lib/logger";
const log = createLogger("amelia-chat-api");

const AMELIA_SYSTEM_PROMPT = `You are Amelia, an AI assistant built into Dispute2Go that specializes in credit repair strategy and FCRA/FDCPA compliance.

You help credit repair specialists with:
- Analyzing client credit reports and identifying disputable items
- Recommending dispute strategies including which flow (Accuracy, Collection, Consent, Combo, Late Payment), which round, and which CRA to target
- Explaining FCRA (Fair Credit Reporting Act) and FDCPA (Fair Debt Collection Practices Act) legal concepts in plain, actionable language
- Guiding specialists through the eOSCAR dispute process and CRA response handling
- Suggesting next steps based on CRA responses (verified, deleted, no response)
- Answering questions about permissible purpose, dispute timelines, and consumer rights under 15 USC 1681 et seq.
- Identifying patterns in dispute outcomes to optimize strategy

Key legal knowledge:
- FCRA Section 611 (15 USC 1681i): Consumer dispute rights and CRA investigation obligations (30-day window)
- FCRA Section 609 (15 USC 1681g): Consumer right to disclosure of information in their file
- FCRA Section 623 (15 USC 1681s-2): Furnisher duties upon notice of dispute
- FDCPA Section 809 (15 USC 1692g): Debt validation requirements
- FCRA Section 605 (15 USC 1681c): Reporting time limits (7 years for most negatives, 10 years for bankruptcies)
- FCRA Section 604 (15 USC 1681b): Permissible purposes for accessing consumer reports
- Method of Verification (MOV) demands under 15 USC 1681i(a)(7)

Guidelines:
- Be conversational but professional. You are a knowledgeable colleague, not a chatbot.
- Cite specific FCRA/FDCPA sections when discussing legal rights or obligations.
- When recommending strategies, always explain WHY that approach works for the specific situation.
- If you lack enough context about a client or situation, ask clarifying questions before recommending a strategy.
- Never provide legal advice. You provide dispute strategy recommendations and educational information about consumer rights law.
- Keep responses concise and actionable. Credit repair specialists are busy.`;

function buildSystemPrompt(clientContext?: string): string {
  if (!clientContext) {
    return AMELIA_SYSTEM_PROMPT;
  }

  return `${AMELIA_SYSTEM_PROMPT}

=== ACTIVE CLIENT CONTEXT ===
The specialist is currently viewing a client file. Use this context to provide specific, data-driven recommendations. Reference actual accounts, dispute history, scores, and patterns when relevant.

${clientContext}`;
}

/** Extract text content from a UIMessage's parts array */
function getTextFromParts(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      messages: rawMessages,
      clientId,
      conversationId: existingConversationId,
    } = body as {
      messages: UIMessage[];
      clientId?: string;
      conversationId?: string;
    };

    if (
      !rawMessages ||
      !Array.isArray(rawMessages) ||
      rawMessages.length === 0
    ) {
      return NextResponse.json(
        { error: "Messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;
    const userId = session.user.id;

    // Load client context if a clientId was provided
    let clientContextString: string | undefined;
    if (clientId) {
      try {
        const context = await assembleClientContext(
          clientId,
          organizationId,
          "CHAT"
        );
        clientContextString = formatContextForPrompt(context);
      } catch (ctxError) {
        log.warn({ err: ctxError }, "[Amelia Chat] Failed to assemble client context, proceeding without it");
      }
    }

    const systemPrompt = buildSystemPrompt(clientContextString);

    // Determine or create the conversation
    let conversationId = existingConversationId;

    if (!conversationId) {
      // Extract text from the first user message for auto-title
      const firstUserMsg = rawMessages.find((m) => m.role === "user");
      const firstText = firstUserMsg
        ? getTextFromParts(
            firstUserMsg.parts as Array<{ type: string; text?: string }>
          )
        : "";
      const autoTitle = firstText
        ? firstText.slice(0, 100) + (firstText.length > 100 ? "..." : "")
        : "New conversation";

      const conversation = await prisma.ameliaConversation.create({
        data: {
          title: autoTitle,
          status: "ACTIVE",
          userId,
          clientId: clientId || null,
          organizationId,
        },
      });

      conversationId = conversation.id;
    }

    // Convert UIMessages to ModelMessages for the LLM
    const llmMessages = await convertToModelMessages(rawMessages);

    // Stream the response from the LLM orchestrator
    const result = await streamLLM({
      taskType: "CHAT",
      prompt: "",
      systemPrompt,
      organizationId,
      context: clientId ? { flow: "CHAT" } : undefined,
      messages: llmMessages,
    });

    // Save the latest user message to the database
    const lastUserMsg = [...rawMessages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMsg) {
      const userText = getTextFromParts(
        lastUserMsg.parts as Array<{ type: string; text?: string }>
      );
      if (userText) {
        await prisma.ameliaMessage.create({
          data: {
            conversationId,
            role: "user",
            content: userText,
          },
        });
      }
    }

    // Use the result's text promise to save the assistant message once streaming finishes
    result.text.then(async (fullText) => {
      try {
        await prisma.ameliaMessage.create({
          data: {
            conversationId: conversationId!,
            role: "assistant",
            content: fullText,
          },
        });

        // Update conversation metadata
        await prisma.ameliaConversation.update({
          where: { id: conversationId! },
          data: {
            messageCount: { increment: 2 },
            updatedAt: new Date(),
          },
        });
      } catch (saveError) {
        log.error({ err: saveError }, "[Amelia Chat] Failed to save assistant message");
      }
    });

    // Return the streaming response with the conversationId header
    const response = result.toTextStreamResponse();

    // Attach the conversationId so the client knows which conversation this belongs to
    response.headers.set("X-Conversation-Id", conversationId);

    return response;
  } catch (error) {
    log.error({ err: error }, "[Amelia Chat] Error");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process chat request",
      },
      { status: 500 }
    );
  }
}
