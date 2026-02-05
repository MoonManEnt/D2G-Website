import { createLogger } from "./logger";
const log = createLogger("mail");

/**
 * Physical Mail Service
 *
 * Integrates with Lob to send physical dispute letters.
 * Supports letter sending, address verification, and tracking.
 */

// Note: Lob package types, using dynamic import for Node.js compatibility
interface LobAddress {
  name: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
}

interface LobLetter {
  id: string;
  description: string;
  to: LobAddress;
  from: LobAddress;
  send_date: string;
  expected_delivery_date: string;
  tracking_events: Array<{
    type: string;
    time: string;
    location?: string;
  }>;
  url?: string;
  carrier: string;
}

interface LobLetterCreateParams {
  description?: string;
  to: LobAddress;
  from: LobAddress;
  file: string | Buffer;
  color: boolean;
  double_sided?: boolean;
  address_placement?: "top_first_page" | "insert_blank_page";
  mail_type?: "usps_first_class" | "usps_standard";
  merge_variables?: Record<string, string>;
  send_date?: string;
  extra_service?: "certified" | "certified_return_receipt" | "registered";
}

interface AddressVerificationResult {
  valid: boolean;
  deliverability: "deliverable" | "deliverable_unnecessary_unit" | "deliverable_incorrect_unit" | "deliverable_missing_unit" | "undeliverable";
  primaryLine: string;
  city: string;
  state: string;
  zip: string;
  components?: {
    primaryNumber: string;
    streetPredirection?: string;
    streetName: string;
    streetSuffix?: string;
    streetPostdirection?: string;
    secondaryDesignator?: string;
    secondaryNumber?: string;
    city: string;
    state: string;
    zipCode: string;
    zipCodePlus4?: string;
  };
}

// Lob configuration
const LOB_API_KEY = process.env.LOB_API_KEY;
const LOB_TEST_MODE = process.env.LOB_TEST_MODE === "true";
const FEATURE_PHYSICAL_MAIL_ENABLED = process.env.FEATURE_PHYSICAL_MAIL_ENABLED === "true";

// Default sender address (your business)
const DEFAULT_FROM_ADDRESS: LobAddress = {
  name: process.env.DEFAULT_COMPANY_NAME || "Dispute2Go",
  address_line1: process.env.DEFAULT_SENDER_ADDRESS || "123 Main Street",
  address_city: process.env.DEFAULT_SENDER_CITY || "New York",
  address_state: process.env.DEFAULT_SENDER_STATE || "NY",
  address_zip: process.env.DEFAULT_SENDER_ZIP || "10001",
  address_country: "US",
};

// CRA Addresses
const CRA_ADDRESSES: Record<string, LobAddress> = {
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address_line1: "P.O. Box 740256",
    address_city: "Atlanta",
    address_state: "GA",
    address_zip: "30374-0256",
    address_country: "US",
  },
  EXPERIAN: {
    name: "Experian",
    address_line1: "P.O. Box 4500",
    address_city: "Allen",
    address_state: "TX",
    address_zip: "75013",
    address_country: "US",
  },
  TRANSUNION: {
    name: "TransUnion LLC",
    address_line1: "P.O. Box 2000",
    address_city: "Chester",
    address_state: "PA",
    address_zip: "19016",
    address_country: "US",
  },
};

export type CRAType = keyof typeof CRA_ADDRESSES;

/**
 * Check if physical mail service is available
 */
export function isMailServiceAvailable(): boolean {
  return FEATURE_PHYSICAL_MAIL_ENABLED && !!LOB_API_KEY;
}

/**
 * Get Lob client instance
 */
async function getLobClient() {
  if (!LOB_API_KEY) {
    throw new Error("Lob API key not configured");
  }

  const Lob = (await import("lob")).default;
  return new Lob({ apiKey: LOB_API_KEY });
}

/**
 * Verify a mailing address
 */
export async function verifyAddress(address: {
  name?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
}): Promise<AddressVerificationResult> {
  if (!LOB_API_KEY) {
    throw new Error("Lob API key not configured. Set LOB_API_KEY environment variable.");
  }

  try {
    const lob = await getLobClient();

    const verification = await lob.usVerifications.verify({
      primary_line: address.addressLine1,
      secondary_line: address.addressLine2 || "",
      city: address.city,
      state: address.state,
      zip_code: address.zip,
    });

    return {
      valid: verification.deliverability === "deliverable",
      deliverability: verification.deliverability,
      primaryLine: verification.primary_line || address.addressLine1,
      city: verification.components?.city || address.city,
      state: verification.components?.state || address.state,
      zip: verification.components?.zip_code || address.zip,
      components: verification.components
        ? {
            primaryNumber: verification.components.primary_number || "",
            streetPredirection: verification.components.street_predirection,
            streetName: verification.components.street_name || "",
            streetSuffix: verification.components.street_suffix,
            streetPostdirection: verification.components.street_postdirection,
            secondaryDesignator: verification.components.secondary_designator,
            secondaryNumber: verification.components.secondary_number,
            city: verification.components.city || "",
            state: verification.components.state || "",
            zipCode: verification.components.zip_code || "",
            zipCodePlus4: verification.components.zip_code_plus_4,
          }
        : undefined,
    };
  } catch (error) {
    log.error({ err: error }, "Address verification error");
    return {
      valid: false,
      deliverability: "undeliverable",
      primaryLine: address.addressLine1,
      city: address.city,
      state: address.state,
      zip: address.zip,
    };
  }
}

/**
 * Send a dispute letter via physical mail
 */
export interface SendLetterParams {
  // Letter content (PDF buffer or URL)
  letterPdf: Buffer | string;

  // Recipient info (the CRA)
  cra: CRAType;

  // Sender info (client)
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;

  // Options
  description?: string;
  color?: boolean;
  doubleSided?: boolean;
  mailType?: "usps_first_class" | "usps_standard";
  extraService?: "certified" | "certified_return_receipt" | "registered";
  sendDate?: Date;
}

export interface SendLetterResult {
  success: boolean;
  letterId?: string;
  expectedDeliveryDate?: string;
  trackingUrl?: string;
  error?: string;
  testMode?: boolean;
}

export async function sendDisputeLetter(params: SendLetterParams): Promise<SendLetterResult> {
  if (!FEATURE_PHYSICAL_MAIL_ENABLED) {
    return {
      success: false,
      error: "Physical mail feature is not enabled. Set FEATURE_PHYSICAL_MAIL_ENABLED=true",
    };
  }

  if (!LOB_API_KEY) {
    return {
      success: false,
      error: "Lob API key not configured. Set LOB_API_KEY environment variable.",
    };
  }

  try {
    const lob = await getLobClient();

    const craAddress = CRA_ADDRESSES[params.cra];
    if (!craAddress) {
      return {
        success: false,
        error: `Unknown CRA: ${params.cra}`,
      };
    }

    const fromAddress: LobAddress = {
      name: params.clientName,
      address_line1: params.clientAddress,
      address_city: params.clientCity,
      address_state: params.clientState,
      address_zip: params.clientZip,
      address_country: "US",
    };

    // Prepare file - either URL or base64 encoded PDF
    let file: string;
    if (Buffer.isBuffer(params.letterPdf)) {
      file = `data:application/pdf;base64,${params.letterPdf.toString("base64")}`;
    } else {
      file = params.letterPdf;
    }

    const letterParams: LobLetterCreateParams = {
      description: params.description || `Dispute Letter to ${params.cra}`,
      to: craAddress,
      from: fromAddress,
      file,
      color: params.color ?? false,
      double_sided: params.doubleSided ?? true,
      address_placement: "top_first_page",
      mail_type: params.mailType || "usps_first_class",
    };

    // Add extra service if specified
    if (params.extraService) {
      letterParams.extra_service = params.extraService;
    }

    // Add send date if specified (for scheduling)
    if (params.sendDate) {
      letterParams.send_date = params.sendDate.toISOString().split("T")[0];
    }

    const letter = await lob.letters.create(letterParams);

    return {
      success: true,
      letterId: letter.id,
      expectedDeliveryDate: letter.expected_delivery_date,
      trackingUrl: letter.url,
      testMode: LOB_TEST_MODE,
    };
  } catch (error) {
    log.error({ err: error }, "Send letter error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send letter",
    };
  }
}

/**
 * Get tracking information for a letter
 */
export async function getLetterTracking(letterId: string): Promise<{
  success: boolean;
  status?: string;
  events?: Array<{
    type: string;
    time: string;
    location?: string;
  }>;
  expectedDelivery?: string;
  error?: string;
}> {
  if (!LOB_API_KEY) {
    return {
      success: false,
      error: "Lob API key not configured. Set LOB_API_KEY environment variable.",
    };
  }

  try {
    const lob = await getLobClient();
    const letter = await lob.letters.retrieve(letterId);

    // Determine status from tracking events
    const events = letter.tracking_events || [];
    const latestEvent = events[events.length - 1];

    return {
      success: true,
      status: latestEvent?.type || "Processing",
      events: events.map((e) => ({
        type: e.type,
        time: e.time,
        location: e.location,
      })),
      expectedDelivery: letter.expected_delivery_date,
    };
  } catch (error) {
    log.error({ err: error }, "Get tracking error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get tracking",
    };
  }
}

/**
 * Cancel a scheduled letter (only works if not yet processed)
 */
export async function cancelLetter(letterId: string): Promise<{
  success: boolean;
  cancelled: boolean;
  error?: string;
}> {
  if (!LOB_API_KEY) {
    return {
      success: false,
      cancelled: false,
      error: "Lob API key not configured. Set LOB_API_KEY environment variable.",
    };
  }

  try {
    const lob = await getLobClient();
    const result = await lob.letters.cancel(letterId);

    return {
      success: true,
      cancelled: result.deleted || false,
    };
  } catch (error) {
    log.error({ err: error }, "Cancel letter error");
    return {
      success: false,
      cancelled: false,
      error: error instanceof Error ? error.message : "Failed to cancel letter",
    };
  }
}

/**
 * Get pricing estimate for a letter
 */
export function getLetterPricing(options: {
  pages?: number;
  color?: boolean;
  extraService?: "certified" | "certified_return_receipt" | "registered";
  mailType?: "usps_first_class" | "usps_standard";
}): {
  baseCost: number;
  extraServiceCost: number;
  totalCost: number;
  currency: string;
} {
  // Base pricing (approximate Lob rates)
  const baseRates = {
    usps_first_class: 0.63,
    usps_standard: 0.48,
  };

  const extraServiceRates = {
    certified: 4.15,
    certified_return_receipt: 7.15,
    registered: 15.0,
  };

  const colorMultiplier = options.color ? 1.5 : 1;
  const pageMultiplier = Math.ceil((options.pages || 1) / 6); // Additional sheets

  const baseCost = baseRates[options.mailType || "usps_first_class"] * colorMultiplier * pageMultiplier;
  const extraServiceCost = options.extraService ? extraServiceRates[options.extraService] : 0;

  return {
    baseCost: Math.round(baseCost * 100) / 100,
    extraServiceCost,
    totalCost: Math.round((baseCost + extraServiceCost) * 100) / 100,
    currency: "USD",
  };
}

/**
 * Get CRA mailing address
 */
export function getCRAAddress(cra: CRAType): LobAddress | null {
  return CRA_ADDRESSES[cra] || null;
}

/**
 * List all available CRAs
 */
export function getAvailableCRAs(): Array<{ code: CRAType; name: string; address: LobAddress }> {
  return Object.entries(CRA_ADDRESSES).map(([code, address]) => ({
    code: code as CRAType,
    name: address.name,
    address,
  }));
}
