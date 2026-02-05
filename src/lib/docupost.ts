import { createLogger } from "./logger";
const log = createLogger("docupost");

/**
 * DocuPost API Service
 *
 * Sends physical letters via the DocuPost API.
 * API endpoint: POST https://app.docupost.com/api/1.1/wf/sendletter
 * Authentication: api_token query parameter
 *
 * Environment variables:
 *   DOCUPOST_API_TOKEN - API authentication token
 *   DOCUPOST_API_URL - API base URL (defaults to https://app.docupost.com/api/1.1/wf/sendletter)
 */

export interface DocuPostSendParams {
  // Recipient (To) address
  toName: string;
  toAddress1: string;
  toAddress2?: string;
  toCity: string;
  toState: string;
  toZip: string;

  // Sender (From) address
  fromName: string;
  fromAddress1: string;
  fromAddress2?: string;
  fromCity: string;
  fromState: string;
  fromZip: string;

  // Content - provide either pdf URL or html content
  pdf?: string; // URL to a PDF file
  html?: string; // HTML content (max 9000 characters)

  // Options
  color?: boolean;
  doublesided?: boolean;
  servicelevel?: "certified" | "certified_return_receipt";
  return_envelope?: boolean;
  description?: string;
}

export interface DocuPostSendResult {
  success: boolean;
  letterId?: string;
  error?: string;
}

/**
 * Build a query-string URL from the base URL and params object.
 * All values are URL-encoded.
 */
function buildDocuPostUrl(
  baseUrl: string,
  apiToken: string,
  params: DocuPostSendParams
): string {
  const url = new URL(baseUrl);

  // Auth
  url.searchParams.set("api_token", apiToken);

  // Recipient address
  url.searchParams.set("toName", params.toName);
  url.searchParams.set("toAddress1", params.toAddress1);
  if (params.toAddress2) url.searchParams.set("toAddress2", params.toAddress2);
  url.searchParams.set("toCity", params.toCity);
  url.searchParams.set("toState", params.toState);
  url.searchParams.set("toZip", params.toZip);

  // Sender address
  url.searchParams.set("fromName", params.fromName);
  url.searchParams.set("fromAddress1", params.fromAddress1);
  if (params.fromAddress2)
    url.searchParams.set("fromAddress2", params.fromAddress2);
  url.searchParams.set("fromCity", params.fromCity);
  url.searchParams.set("fromState", params.fromState);
  url.searchParams.set("fromZip", params.fromZip);

  // Content
  if (params.pdf) {
    url.searchParams.set("pdf", params.pdf);
  }
  if (params.html) {
    url.searchParams.set("html", params.html);
  }

  // Options
  if (params.color !== undefined) {
    url.searchParams.set("color", params.color ? "true" : "false");
  }
  if (params.doublesided !== undefined) {
    url.searchParams.set("doublesided", params.doublesided ? "true" : "false");
  }
  if (params.servicelevel) {
    url.searchParams.set("servicelevel", params.servicelevel);
  }
  if (params.return_envelope !== undefined) {
    url.searchParams.set(
      "return_envelope",
      params.return_envelope ? "true" : "false"
    );
  }
  if (params.description) {
    url.searchParams.set("description", params.description);
  }

  return url.toString();
}

/**
 * Send a letter via DocuPost API.
 *
 * Makes a POST request to the DocuPost sendletter endpoint with all
 * parameters encoded as query string params.
 *
 * @param params - Letter parameters including addresses and content
 * @returns Result with success status, letter ID on success, or error message
 */
export async function sendLetterViaDocuPost(
  params: DocuPostSendParams
): Promise<DocuPostSendResult> {
  const apiToken = process.env.DOCUPOST_API_TOKEN;
  if (!apiToken) {
    return {
      success: false,
      error: "DocuPost API token is not configured (DOCUPOST_API_TOKEN)",
    };
  }

  const baseUrl =
    process.env.DOCUPOST_API_URL ||
    "https://app.docupost.com/api/1.1/wf/sendletter";

  // Validate that at least one content source is provided
  if (!params.pdf && !params.html) {
    return {
      success: false,
      error: "Either pdf URL or html content must be provided",
    };
  }

  // Enforce HTML max length
  if (params.html && params.html.length > 9000) {
    return {
      success: false,
      error: `HTML content exceeds maximum length of 9000 characters (got ${params.html.length})`,
    };
  }

  try {
    const requestUrl = buildDocuPostUrl(baseUrl, apiToken, params);

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ arg0: response.status, errorText }, "DocuPost API error");
      return {
        success: false,
        error: `DocuPost API returned ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();

    // DocuPost returns the letter ID in the response
    const letterId =
      data?.response?.id ||
      data?.response?.letter_id ||
      data?.id ||
      data?.letter_id;

    return {
      success: true,
      letterId: letterId || undefined,
    };
  } catch (error) {
    log.error({ err: error }, "DocuPost send error");
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error sending via DocuPost",
    };
  }
}

/**
 * Check if DocuPost is configured and available.
 */
export function isDocuPostAvailable(): boolean {
  return !!process.env.DOCUPOST_API_TOKEN;
}
