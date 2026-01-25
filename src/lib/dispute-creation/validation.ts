/**
 * Unified Dispute Creation Validation
 *
 * Shared validation logic for all dispute creation flows.
 */

import { Session } from "next-auth";
import prisma from "@/lib/prisma";
import {
  UnifiedDisputeRequest,
  DisputeClientData,
  DisputeAccountData,
  CRA,
} from "./types";

/**
 * Valid CRA values
 */
const VALID_CRAS: CRA[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];

/**
 * Valid flow values
 */
const VALID_FLOWS = ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"];

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * Validated request context
 */
export interface ValidatedRequestContext {
  client: DisputeClientData;
  accounts: DisputeAccountData[];
  organizationId: string;
  userId: string;
  userEmail: string;
}

/**
 * Validate the base request parameters
 */
export function validateBaseRequest(
  body: Partial<UnifiedDisputeRequest>
): ValidationResult {
  if (!body.clientId) {
    return {
      valid: false,
      error: "clientId is required",
      code: "MISSING_CLIENT_ID",
    };
  }

  if (!body.accountIds || !Array.isArray(body.accountIds) || body.accountIds.length === 0) {
    return {
      valid: false,
      error: "accountIds is required and must be a non-empty array",
      code: "MISSING_ACCOUNT_IDS",
    };
  }

  return { valid: true };
}

/**
 * Validate simple dispute request
 */
export function validateSimpleRequest(
  body: Partial<UnifiedDisputeRequest>
): ValidationResult {
  const baseValidation = validateBaseRequest(body);
  if (!baseValidation.valid) return baseValidation;

  if (!body.cra) {
    return {
      valid: false,
      error: "cra is required for simple dispute creation",
      code: "MISSING_CRA",
    };
  }

  if (!VALID_CRAS.includes(body.cra as CRA)) {
    return {
      valid: false,
      error: `Invalid CRA. Must be one of: ${VALID_CRAS.join(", ")}`,
      code: "INVALID_CRA",
    };
  }

  if (!body.flow) {
    return {
      valid: false,
      error: "flow is required for simple dispute creation",
      code: "MISSING_FLOW",
    };
  }

  if (!VALID_FLOWS.includes(body.flow)) {
    return {
      valid: false,
      error: `Invalid flow. Must be one of: ${VALID_FLOWS.join(", ")}`,
      code: "INVALID_FLOW",
    };
  }

  return { valid: true };
}

/**
 * Validate AI dispute request
 */
export function validateAIRequest(
  body: Partial<UnifiedDisputeRequest>
): ValidationResult {
  const baseValidation = validateBaseRequest(body);
  if (!baseValidation.valid) return baseValidation;

  // CRA and flow are optional for AI requests (auto-determined)
  if (body.cra && !VALID_CRAS.includes(body.cra as CRA)) {
    return {
      valid: false,
      error: `Invalid CRA. Must be one of: ${VALID_CRAS.join(", ")}`,
      code: "INVALID_CRA",
    };
  }

  if (body.flow && !VALID_FLOWS.includes(body.flow)) {
    return {
      valid: false,
      error: `Invalid flow. Must be one of: ${VALID_FLOWS.join(", ")}`,
      code: "INVALID_FLOW",
    };
  }

  return { valid: true };
}

/**
 * Validate AMELIA dispute request
 */
export function validateAmeliaRequest(
  body: Partial<UnifiedDisputeRequest>
): ValidationResult {
  const baseValidation = validateBaseRequest(body);
  if (!baseValidation.valid) return baseValidation;

  if (!body.cra) {
    return {
      valid: false,
      error: "cra is required for AMELIA dispute creation",
      code: "MISSING_CRA",
    };
  }

  if (!VALID_CRAS.includes(body.cra as CRA)) {
    return {
      valid: false,
      error: `Invalid CRA. Must be one of: ${VALID_CRAS.join(", ")}`,
      code: "INVALID_CRA",
    };
  }

  // Flow is optional for AMELIA (can auto-determine)
  if (body.flow && !VALID_FLOWS.includes(body.flow)) {
    return {
      valid: false,
      error: `Invalid flow. Must be one of: ${VALID_FLOWS.join(", ")}`,
      code: "INVALID_FLOW",
    };
  }

  return { valid: true };
}

/**
 * Validate request based on type
 */
export function validateRequest(
  body: Partial<UnifiedDisputeRequest>
): ValidationResult {
  if (!body.type) {
    return {
      valid: false,
      error: "type is required. Must be 'simple', 'ai', or 'amelia'",
      code: "MISSING_TYPE",
    };
  }

  switch (body.type) {
    case "simple":
      return validateSimpleRequest(body);
    case "ai":
      return validateAIRequest(body);
    case "amelia":
      return validateAmeliaRequest(body);
    default:
      return {
        valid: false,
        error: "Invalid type. Must be 'simple', 'ai', or 'amelia'",
        code: "INVALID_TYPE",
      };
  }
}

/**
 * Fetch and validate client exists and belongs to organization
 */
export async function fetchAndValidateClient(
  clientId: string,
  organizationId: string
): Promise<{ client: DisputeClientData | null; error?: string }> {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      organizationId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zipCode: true,
      ssnLast4: true,
      dateOfBirth: true,
      phone: true,
    },
  });

  if (!client) {
    return { client: null, error: "Client not found" };
  }

  return { client };
}

/**
 * Validate client has complete address information
 */
export function validateClientAddress(client: DisputeClientData): ValidationResult {
  if (!client.addressLine1 || !client.city || !client.state || !client.zipCode) {
    return {
      valid: false,
      error: "Client address information is incomplete. Please update client profile.",
      code: "INCOMPLETE_ADDRESS",
    };
  }
  return { valid: true };
}

/**
 * Validate client has Date of Birth (REQUIRED for dispute letters)
 * DOB is a HARD REQUIREMENT - letters cannot be generated without it
 */
export function validateClientDOB(client: DisputeClientData): ValidationResult {
  if (!client.dateOfBirth) {
    return {
      valid: false,
      error: "Client Date of Birth is required for dispute letters. Please update the client profile with their DOB.",
      code: "MISSING_DOB",
    };
  }
  return { valid: true };
}

/**
 * Validate client has SSN last 4 (REQUIRED for dispute letters)
 */
export function validateClientSSN4(client: DisputeClientData): ValidationResult {
  if (!client.ssnLast4) {
    return {
      valid: false,
      error: "Client SSN (last 4 digits) is required for dispute letters. Please update the client profile.",
      code: "MISSING_SSN4",
    };
  }
  return { valid: true };
}

/**
 * Validate all required client information for letter generation
 */
export function validateClientForLetter(client: DisputeClientData): ValidationResult {
  // Address validation
  const addressValidation = validateClientAddress(client);
  if (!addressValidation.valid) return addressValidation;

  // DOB validation - HARD REQUIREMENT
  const dobValidation = validateClientDOB(client);
  if (!dobValidation.valid) return dobValidation;

  // SSN4 validation
  const ssn4Validation = validateClientSSN4(client);
  if (!ssn4Validation.valid) return ssn4Validation;

  return { valid: true };
}

/**
 * Fetch and validate accounts exist and belong to organization
 */
export async function fetchAndValidateAccounts(
  accountIds: string[],
  organizationId: string,
  clientId: string,
  cra?: CRA
): Promise<{ accounts: DisputeAccountData[]; error?: string }> {
  const whereClause: Record<string, unknown> = {
    id: { in: accountIds },
    organizationId,
    clientId,
  };

  // If CRA is specified, filter by it
  if (cra) {
    whereClause.cra = cra;
  }

  const accounts = await prisma.accountItem.findMany({
    where: whereClause,
    select: {
      id: true,
      creditorName: true,
      maskedAccountId: true,
      cra: true,
      accountType: true,
      accountStatus: true,
      balance: true,
      pastDue: true,
      creditLimit: true,
      dateOpened: true,
      dateReported: true,
      paymentStatus: true,
      confidenceScore: true,
      detectedIssues: true,
      isDisputable: true,
    },
  });

  if (accounts.length === 0) {
    return {
      accounts: [],
      error: cra
        ? `No valid accounts found for the specified CRA (${cra})`
        : "No valid accounts found",
    };
  }

  // Transform balance/pastDue/creditLimit to numbers (they might be Decimal from Prisma)
  const transformedAccounts: DisputeAccountData[] = accounts.map((acc) => ({
    ...acc,
    balance: acc.balance ? Number(acc.balance) : null,
    pastDue: acc.pastDue ? Number(acc.pastDue) : null,
    creditLimit: acc.creditLimit ? Number(acc.creditLimit) : null,
  }));

  return { accounts: transformedAccounts };
}

/**
 * Full validation flow - validates session, request, client, and accounts
 */
export async function validateFullRequest(
  session: Session | null,
  body: Partial<UnifiedDisputeRequest>
): Promise<
  | { valid: true; context: ValidatedRequestContext }
  | { valid: false; error: string; code?: string; status: number }
> {
  // Validate session
  if (!session?.user) {
    return {
      valid: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      status: 401,
    };
  }

  // Validate request parameters
  const requestValidation = validateRequest(body);
  if (!requestValidation.valid) {
    return {
      valid: false,
      error: requestValidation.error!,
      code: requestValidation.code,
      status: 400,
    };
  }

  // Fetch and validate client
  const { client, error: clientError } = await fetchAndValidateClient(
    body.clientId!,
    session.user.organizationId
  );

  if (!client) {
    return {
      valid: false,
      error: clientError || "Client not found",
      code: "CLIENT_NOT_FOUND",
      status: 404,
    };
  }

  // Validate ALL client information required for letters (address, DOB, SSN4)
  const clientValidation = validateClientForLetter(client);
  if (!clientValidation.valid) {
    return {
      valid: false,
      error: clientValidation.error!,
      code: clientValidation.code,
      status: 400,
    };
  }

  // Fetch and validate accounts
  const { accounts, error: accountsError } = await fetchAndValidateAccounts(
    body.accountIds!,
    session.user.organizationId,
    body.clientId!,
    body.cra as CRA | undefined
  );

  if (accounts.length === 0) {
    return {
      valid: false,
      error: accountsError || "No valid accounts found",
      code: "NO_ACCOUNTS",
      status: 400,
    };
  }

  return {
    valid: true,
    context: {
      client,
      accounts,
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email || "",
    },
  };
}

/**
 * Get next round number for a client/CRA combination
 */
export async function getNextRound(clientId: string, cra: CRA): Promise<number> {
  const lastDispute = await prisma.dispute.findFirst({
    where: {
      clientId,
      cra,
    },
    orderBy: { round: "desc" },
    select: { round: true },
  });

  return (lastDispute?.round || 0) + 1;
}
