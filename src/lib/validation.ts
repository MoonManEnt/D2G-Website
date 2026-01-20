import { z } from "zod";
import { FILE_LIMITS, FileValidationResult } from "@/types";

// ============================================================================
// USER & AUTH SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["ADMIN", "SPECIALIST"]),
});

// ============================================================================
// CLIENT SCHEMAS
// ============================================================================

export const clientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, "Use 2-letter state code").optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code")
    .optional()
    .or(z.literal("")),
  ssnLast4: z
    .string()
    .regex(/^\d{4}$/, "Must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ============================================================================
// ACCOUNT ITEM SCHEMAS
// ============================================================================

export const accountOverrideSchema = z.object({
  creditorName: z.string().min(1, "Creditor name is required"),
  maskedAccountId: z.string().min(1, "Account ID is required"),
  accountType: z.string().optional(),
  accountStatus: z.enum(["OPEN", "CLOSED", "PAID", "CHARGED_OFF", "COLLECTION", "UNKNOWN"]),
  balance: z.number().optional(),
  pastDue: z.number().optional(),
  creditLimit: z.number().optional(),
  disputeComment: z.string().optional(),
});

export const flowAssignmentSchema = z.object({
  accountId: z.string().uuid(),
  flow: z.enum(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"]),
});

// ============================================================================
// DISPUTE SCHEMAS
// ============================================================================

export const createDisputeSchema = z.object({
  clientId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).min(1, "Select at least one account"),
  flow: z.enum(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"]),
  round: z.number().int().min(1).max(12),
  cra: z.enum(["EXPERIAN", "EQUIFAX", "TRANSUNION"]),
});

export const disputeResponseSchema = z.object({
  disputeId: z.string().uuid(),
  responseOutcome: z.enum(["DELETED", "VERIFIED", "UPDATED", "NO_RESPONSE"]),
  responseNotes: z.string().optional(),
});

// ============================================================================
// DOCUMENT SCHEMAS
// ============================================================================

export const documentApprovalSchema = z.object({
  documentId: z.string().uuid(),
  action: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
  notes: z.string().optional(),
});

// ============================================================================
// EVIDENCE SCHEMAS
// ============================================================================

export const cropRegionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
});

export const annotationSchema = z.object({
  id: z.string(),
  type: z.enum(["BOX", "CIRCLE", "ARROW", "TEXT"]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  radius: z.number().optional(),
  points: z.array(z.number()).optional(),
  text: z.string().optional(),
  color: z.string(),
  strokeWidth: z.number().min(1).max(10),
});

export const createEvidenceSchema = z.object({
  accountItemId: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  sourcePageNum: z.number().int().min(1).optional(),
  cropRegion: cropRegionSchema.optional(),
  annotations: z.array(annotationSchema).optional(),
});

// ============================================================================
// FILE VALIDATION (Recommendation #8)
// ============================================================================

export function validateFile(file: File): FileValidationResult {
  const errors: string[] = [];

  // Check file size
  const maxSizeBytes = FILE_LIMITS.maxFileSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    errors.push(`File size exceeds ${FILE_LIMITS.maxFileSizeMB}MB limit`);
  }

  // Check MIME type
  if (!(FILE_LIMITS.allowedMimeTypes as readonly string[]).includes(file.type)) {
    errors.push(`Invalid file type. Allowed types: ${FILE_LIMITS.allowedMimeTypes.join(", ")}`);
  }

  // Check extension
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!(FILE_LIMITS.allowedExtensions as readonly string[]).includes(extension)) {
    errors.push(`Invalid file extension. Allowed extensions: ${FILE_LIMITS.allowedExtensions.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// GENERAL UTILITIES
// ============================================================================

export function formatValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (path && !errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return errors;
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, "");
}
