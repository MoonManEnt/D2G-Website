/**
 * Unified Mail Provider Abstraction
 *
 * Routes mail sending between DocuPost and Lob (future).
 * Provides a single interface for mailing dispute letters regardless
 * of the underlying provider.
 */

import { CRA_ADDRESSES } from "@/lib/constants/cra-addresses";
import {
  sendLetterViaDocuPost,
  isDocuPostAvailable,
} from "@/lib/docupost";

// =============================================================================
// Types
// =============================================================================

export type MailProvider = "LOB" | "DOCUPOST";

export interface UnifiedSendParams {
  cra: string;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  pdfUrl?: string;
  htmlContent?: string;
  certified?: boolean;
  returnReceipt?: boolean;
  color?: boolean;
  doubleSided?: boolean;
  description?: string;
  provider?: MailProvider;
}

export interface UnifiedSendResult {
  success: boolean;
  provider: MailProvider;
  letterId?: string;
  error?: string;
}

// =============================================================================
// Provider Detection
// =============================================================================

/**
 * Get the default mail provider based on available environment configuration.
 * Checks for DocuPost first, then falls back to Lob.
 */
export function getDefaultProvider(): MailProvider {
  if (isDocuPostAvailable()) {
    return "DOCUPOST";
  }
  return "LOB";
}

// =============================================================================
// Unified Send
// =============================================================================

/**
 * Send a letter through the unified mail provider interface.
 *
 * 1. Determines the provider (from params or default)
 * 2. Looks up the CRA address
 * 3. Dispatches to the appropriate provider
 *
 * @param params - Unified send parameters
 * @returns Unified result with provider info
 */
export async function sendMail(
  params: UnifiedSendParams
): Promise<UnifiedSendResult> {
  const provider = params.provider || getDefaultProvider();

  // Look up CRA address
  const craKey = params.cra.toUpperCase();
  const craAddress = CRA_ADDRESSES[craKey];

  if (!craAddress) {
    return {
      success: false,
      provider,
      error: `Unknown CRA: ${params.cra}. Valid CRAs: ${Object.keys(CRA_ADDRESSES).join(", ")}`,
    };
  }

  // Validate that we have content to send
  if (!params.pdfUrl && !params.htmlContent) {
    return {
      success: false,
      provider,
      error: "Either pdfUrl or htmlContent must be provided",
    };
  }

  // Route to the appropriate provider
  switch (provider) {
    case "DOCUPOST":
      return sendViaDocuPost(params, craAddress, craKey);

    case "LOB":
      return {
        success: false,
        provider: "LOB",
        error:
          "Lob mail provider is not configured. Please use DocuPost or configure Lob credentials.",
      };

    default:
      return {
        success: false,
        provider,
        error: `Unknown mail provider: ${provider}`,
      };
  }
}

// =============================================================================
// DocuPost Provider
// =============================================================================

async function sendViaDocuPost(
  params: UnifiedSendParams,
  craAddress: (typeof CRA_ADDRESSES)[string],
  _craKey: string
): Promise<UnifiedSendResult> {
  // Determine service level
  let servicelevel: "certified" | "certified_return_receipt" | undefined;
  if (params.returnReceipt) {
    servicelevel = "certified_return_receipt";
  } else if (params.certified) {
    servicelevel = "certified";
  }

  const result = await sendLetterViaDocuPost({
    // To: CRA address
    toName: craAddress.name,
    toAddress1: craAddress.address1,
    toCity: craAddress.city,
    toState: craAddress.state,
    toZip: craAddress.zip,

    // From: Client address
    fromName: params.clientName,
    fromAddress1: params.clientAddress,
    fromCity: params.clientCity,
    fromState: params.clientState,
    fromZip: params.clientZip,

    // Content
    pdf: params.pdfUrl,
    html: params.htmlContent,

    // Options
    color: params.color,
    doublesided: params.doubleSided,
    servicelevel,
    description: params.description,
  });

  return {
    success: result.success,
    provider: "DOCUPOST",
    letterId: result.letterId,
    error: result.error,
  };
}
